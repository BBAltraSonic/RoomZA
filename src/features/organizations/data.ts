import "server-only";

import { requireAnyPersona } from "@/lib/auth";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { OrganizationMembershipView, OrganizationRole } from "./types";

type MembershipRow = {
  organization_id: string;
  role: OrganizationRole;
  organizations:
    | { id: string; name: string; slug: string; imports_pilot_enabled: boolean; deleted_at: string | null }
    | Array<{ id: string; name: string; slug: string; imports_pilot_enabled: boolean; deleted_at: string | null }>
    | null;
};

function organizationFrom(row: MembershipRow) {
  return Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
}

export async function requireOrganizationAccount() {
  const account = await requireAnyPersona(["landlord", "seller"], { redirectTo: "/dashboard" });
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const claims = z.object({ sub: z.string().uuid(), session_id: z.string().uuid() }).safeParse(data?.claims);
  if (error || !claims.success || claims.data.sub !== account.user.id) redirect("/auth?redirect=%2Fdashboard%2Forganization");
  const admin = createUntypedClient();
  const active = await admin.rpc("pinpoint_active_session", { actor_id: account.user.id, actor_session_id: claims.data.session_id });
  if (active.error || active.data !== true) redirect("/auth?redirect=%2Fdashboard%2Forganization");
  return account;
}

export async function getOrganizationContext() {
  const { user, profile } = await requireOrganizationAccount();
  const admin = createUntypedClient();

  const [{ data: memberships, error }, { data: profileRow }] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("organization_id, role, organizations!inner(id, name, slug, imports_pilot_enabled, deleted_at)")
      .eq("user_id", user.id)
      .is("revoked_at", null),
    admin.from("profiles").select("active_organization_id").eq("id", user.id).maybeSingle(),
  ]);

  if (error) {
    return {
      user,
      profile,
      memberships: [] as OrganizationMembershipView[],
      activeOrganization: null,
      unavailable: error.code === "42P01",
    };
  }

  const views = ((memberships ?? []) as MembershipRow[])
    .map((membership) => {
      const organization = organizationFrom(membership);
      if (!organization || organization.deleted_at) return null;
      return {
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        role: membership.role,
        importsPilotEnabled: organization.imports_pilot_enabled,
        active: organization.id === profileRow?.active_organization_id,
      } satisfies OrganizationMembershipView;
    })
    .filter((membership): membership is OrganizationMembershipView => Boolean(membership));

  const activeOrganization =
    views.find((membership) => membership.active)
    ?? views[0]
    ?? null;

  return { user, profile, memberships: views, activeOrganization, unavailable: false };
}

export async function getOrganizationManagementData() {
  const context = await getOrganizationContext();
  const organization = context.activeOrganization;
  if (!organization || organization.role === "agent") return { ...context, offices: [], members: [], invitations: [] };
  const admin = createUntypedClient();
  const [offices, members, invitations] = await Promise.all([
    admin.from("organization_offices").select("*").eq("organization_id", organization.organizationId).order("is_default", { ascending: false }).order("name"),
    admin.from("organization_memberships").select("id, user_id, role, office_id, joined_at, profiles!organization_memberships_user_id_fkey!inner(full_name, email)").eq("organization_id", organization.organizationId).is("revoked_at", null).order("role"),
    admin.from("organization_invitations").select("id, email, role, office_id, expires_at, created_at").eq("organization_id", organization.organizationId).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  return {
    ...context,
    offices: offices.data ?? [],
    members: members.data ?? [],
    invitations: invitations.data ?? [],
  };
}
