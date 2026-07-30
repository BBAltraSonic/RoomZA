"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";

import { actionFailure, actionSuccess } from "@/lib/action-result";
import { requireAnyPersona } from "@/lib/auth";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrganizationContext } from "./data";

const organizationIdSchema = z.string().uuid();
const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "agent"]),
  officeId: z.string().uuid().nullable().optional(),
});
const officeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
});

async function requireOrganizationManager() {
  const context = await getOrganizationContext();
  if (!context.activeOrganization || context.activeOrganization.role === "agent") return null;
  return { ...context, organization: context.activeOrganization };
}

export async function selectActiveOrganization(organizationId: string) {
  const parsed = organizationIdSchema.safeParse(organizationId);
  if (!parsed.success) return actionFailure("Choose a valid organization.");

  const { user } = await requireAnyPersona(["landlord", "seller"]);
  const admin = createUntypedClient();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", parsed.data)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (!membership) return actionFailure("You no longer have access to that organization.");

  const { error } = await admin
    .from("profiles")
    .update({ active_organization_id: parsed.data })
    .eq("id", user.id);
  if (error) return actionFailure("Unable to switch organizations.");

  revalidatePath("/dashboard", "layout");
  return actionSuccess({ organizationId: parsed.data });
}

export async function createOrganization(input: { name: string; slug: string }) {
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Use a name and a lowercase URL slug.");
  const { user } = await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as SupabaseClient).rpc("create_organization", {
    organization_name: parsed.data.name,
    organization_slug: parsed.data.slug,
  });
  if (error || typeof data !== "string") {
    return actionFailure(error?.code === "23505" ? "That organization URL is already in use." : "Unable to create the organization.");
  }

  revalidatePath("/dashboard", "layout");
  return actionSuccess({ organizationId: data, ownerId: user.id });
}

export async function inviteOrganizationMember(input: unknown) {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid email, role, and office.");
  const context = await requireOrganizationManager();
  if (!context) return actionFailure("Only organization owners and admins can invite agents.");
  if (parsed.data.role === "admin" && context.organization.role !== "owner") {
    return actionFailure("Only the organization owner can invite an admin.");
  }
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createUntypedClient();
  const { error } = await admin.from("organization_invitations").insert({
    organization_id: context.organization.organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    office_id: parsed.data.officeId ?? null,
    token_hash: tokenHash,
    invited_by: context.user.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  if (error) return actionFailure(error.code === "23505" ? "A current invitation already exists for that email." : "Unable to create the invitation.");
  revalidatePath("/dashboard/organization");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return actionSuccess({ inviteUrl: `${baseUrl}/organization/invite?token=${token}` });
}

export async function createOrganizationOffice(input: unknown) {
  const parsed = officeSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter valid office details.");
  const context = await requireOrganizationManager();
  if (!context) return actionFailure("Only organization owners and admins can manage offices.");
  const admin = createUntypedClient();
  if (parsed.data.isDefault) {
    await admin.from("organization_offices").update({ is_default: false }).eq("organization_id", context.organization.organizationId);
  }
  const { error } = await admin.from("organization_offices").insert({
    organization_id: context.organization.organizationId,
    name: parsed.data.name,
    address: parsed.data.address || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    is_default: parsed.data.isDefault ?? false,
  });
  if (error) return actionFailure(error.code === "23505" ? "That office already exists." : "Unable to create the office.");
  revalidatePath("/dashboard/organization");
  return actionSuccess(undefined);
}

export async function revokeOrganizationMember(membershipId: string) {
  if (!organizationIdSchema.safeParse(membershipId).success) return actionFailure("Choose a valid membership.");
  const context = await requireOrganizationManager();
  if (!context) return actionFailure("Only organization owners and admins can manage agents.");
  const admin = createUntypedClient();
  const { data: membership } = await admin.from("organization_memberships")
    .select("id, user_id, role")
    .eq("id", membershipId)
    .eq("organization_id", context.organization.organizationId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!membership || membership.role === "owner") return actionFailure("Organization ownership cannot be revoked here.");
  if (membership.role === "admin" && context.organization.role !== "owner") return actionFailure("Only the owner can revoke an admin.");
  if (membership.user_id === context.user.id) return actionFailure("Ask another authorized member to revoke your access.");
  const { error } = await admin.from("organization_memberships").update({ revoked_at: new Date().toISOString() }).eq("id", membership.id);
  if (error) return actionFailure("Unable to revoke this membership.");
  revalidatePath("/dashboard/organization");
  return actionSuccess(undefined);
}

export async function acceptOrganizationInvitation(token: string) {
  if (!token || token.length > 500) return actionFailure("This invitation link is invalid.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionFailure("Sign in or create a landlord account before accepting this invitation.");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await (supabase as unknown as SupabaseClient).rpc("accept_organization_invitation", {
    invitation_token_hash: tokenHash,
  });
  if (error || typeof data !== "string") return actionFailure(error?.message ?? "This invitation is invalid or expired.");
  revalidatePath("/dashboard", "layout");
  return actionSuccess({ organizationId: data });
}
