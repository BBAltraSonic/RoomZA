import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";

import { requireAdmin } from "./auth";
import type { AdminListParams, ModerationCase } from "./types";
import { boundedAdminLimit } from "./policy";

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function startOfDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

async function exactCount(table: string, since?: string, filters: Record<string, string> = {}) {
  const admin = createUntypedClient();
  let query = admin.from(table).select("id", { count: "exact", head: true });
  if (since) query = query.gte("created_at", since);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count } = await query;
  return count ?? 0;
}

export async function getAdminOverview() {
  await requireAdmin();
  const [users, listings, cases, applications, viewings, failedJobs, users7, users30, cases7, cases30] = await Promise.all([
    exactCount("profiles"),
    exactCount("listings"),
    exactCount("moderation_cases", undefined, { status: "open" }),
    exactCount("applications"),
    exactCount("viewings"),
    exactCount("notification_events", undefined),
    exactCount("profiles", startOfDaysAgo(7)),
    exactCount("profiles", startOfDaysAgo(30)),
    exactCount("moderation_cases", startOfDaysAgo(7)),
    exactCount("moderation_cases", startOfDaysAgo(30)),
  ]);

  const admin = createUntypedClient();
  const { count: failedCount } = await admin
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .is("sent_at", null)
    .not("last_error", "is", null);

  return {
    totals: { users, listings, cases, applications, viewings, failedJobs: failedCount ?? failedJobs },
    trends: { users7, users30, cases7, cases30 },
  };
}

export async function listAdminCases(params: AdminListParams = {}) {
  await requireAdmin();
  const admin = createUntypedClient();
  const limit = boundedAdminLimit(params.limit);
  let query = admin
    .from("moderation_cases")
    .select("*, reporter:profiles!moderation_cases_reporter_id_fkey(email, full_name), listing:listings(title, address), reported_user:profiles!moderation_cases_reported_user_id_fkey(email, full_name), message:messages(id), listing_image:listing_images(id, listing:listings(title))")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.status) query = query.eq("status", params.status);
  if (params.priority) query = query.eq("priority", params.priority);
  if (params.assignee) query = query.eq("assigned_to", params.assignee);
  if (params.cursor) query = query.lt("created_at", params.cursor);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);

  const { data, error } = await query;
  if (error) throw new Error("Unable to load moderation cases.");
  return data ?? [];
}

export async function getAdminCase(caseId: string) {
  await requireAdmin();
  const admin = createUntypedClient();
  const [{ data: moderationCase }, { data: notes }, { data: grants }] = await Promise.all([
    admin.from("moderation_cases").select("*, reporter:profiles!moderation_cases_reporter_id_fkey(email, full_name), listing:listings(title, address, landlord_id), reported_user:profiles!moderation_cases_reported_user_id_fkey(email, full_name), message:messages(id, conversation_id), listing_image:listing_images(id, listing:listings(title))").eq("id", caseId).maybeSingle(),
    admin.from("moderation_case_notes").select("*").eq("case_id", caseId).order("created_at"),
    admin.from("sensitive_access_grants").select("id, admin_id, resource_type, resource_id, reason, created_at, expires_at, revoked_at").eq("case_id", caseId).order("created_at", { ascending: false }),
  ]);
  return moderationCase ? { moderationCase: moderationCase as ModerationCase & Record<string, unknown>, notes: notes ?? [], grants: grants ?? [] } : null;
}

export async function listAdminUsers(params: AdminListParams = {}) {
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const limit = boundedAdminLimit(params.limit);
  const page = params.cursor ? Math.max(1, Number(params.cursor) || 1) : 1;
  const { data: authUsers, error } = await admin.auth.admin.listUsers({ page, perPage: limit });
  if (error) throw new Error("Unable to load users.");

  let users = authUsers.users;
  const q = params.q?.trim().toLowerCase();
  if (q) users = users.filter((user) => user.email?.toLowerCase().includes(q) || user.id.includes(q));
  const ids = users.map((user) => user.id);
  if (!ids.length) return { users: [], nextPage: authUsers.nextPage, viewer: context };

  const [{ data: profiles }, { data: suspensions }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, role, email_verified_at, created_at").in("id", ids),
    admin.from("account_suspensions").select("user_id, reason, suspended_at, suspended_until, restored_at").in("user_id", ids).is("restored_at", null),
    admin.from("admin_memberships").select("user_id, level, revoked_at").in("user_id", ids),
  ]);

  const mappedUsers = users.map((user) => ({
      id: user.id,
      email: user.email ?? "",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      bannedUntil: user.banned_until ?? null,
      profile: profiles?.find((profile) => profile.id === user.id) ?? null,
      suspension: suspensions?.find((suspension) => suspension.user_id === user.id) ?? null,
      membership: memberships?.find((membership) => membership.user_id === user.id && !membership.revoked_at) ?? null,
    }));
  return {
    users: params.role ? mappedUsers.filter((user) => user.profile?.role === params.role) : mappedUsers,
    nextPage: authUsers.nextPage,
    viewer: context,
  };
}

export async function getAdminUser(userId: string) {
  await requireAdmin();
  const admin = createUntypedClient();
  const [{ data: authUser }, { data: profile }, { data: suspensions }, { data: membership }, { data: cases }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("id, email, full_name, phone, role, email_verified_at, phone_verified, created_at, updated_at").eq("id", userId).maybeSingle(),
    admin.from("account_suspensions").select("*").eq("user_id", userId).order("suspended_at", { ascending: false }),
    admin.from("admin_memberships").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("moderation_cases").select("id, status, priority, category, created_at").or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`).order("created_at", { ascending: false }).limit(20),
  ]);
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId });
  return authUser.user ? { user: authUser.user, profile, suspensions: suspensions ?? [], membership, cases: cases ?? [], factorCount: factors?.factors.filter((factor) => factor.status === "verified").length ?? 0 } : null;
}

export async function listAdminListings(params: AdminListParams = {}) {
  await requireAdmin();
  const admin = createUntypedClient();
  const limit = boundedAdminLimit(params.limit);
  let query = admin
    .from("listings")
    .select("id, title, address, status, price, listing_type, landlord_id, created_at, landlord:profiles!listings_landlord_id_fkey(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (params.status) query = query.eq("status", params.status);
  if (params.q) query = query.or(`title.ilike.%${params.q}%,address.ilike.%${params.q}%`);
  if (params.cursor) query = query.lt("created_at", params.cursor);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load listings.");
  const ids = (data ?? []).map((listing) => listing.id);
  const { data: restrictions } = ids.length
    ? await admin.from("listing_restrictions").select("listing_id, reason, restricted_at, restored_at").in("listing_id", ids).is("restored_at", null)
    : { data: [] };
  return (data ?? []).map((listing) => ({ ...listing, landlord: singleRelation(listing.landlord), restriction: restrictions?.find((item) => item.listing_id === listing.id) ?? null }));
}

export async function getAdminListing(listingId: string) {
  await requireAdmin();
  const admin = createUntypedClient();
  const [{ data: listing }, { data: restrictions }, { data: cases }, { data: accreditation }] = await Promise.all([
    admin.from("listings").select("*, landlord:profiles!listings_landlord_id_fkey(email, full_name)").eq("id", listingId).maybeSingle(),
    admin.from("listing_restrictions").select("*").eq("listing_id", listingId).order("restricted_at", { ascending: false }),
    admin.from("moderation_cases").select("id, status, priority, category, created_at").eq("listing_id", listingId).order("created_at", { ascending: false }),
    admin.from("listing_accreditations").select("listing_id, nsfas_approved, verified_by, verified_at").eq("listing_id", listingId).maybeSingle(),
  ]);
  return listing ? { listing, restrictions: restrictions ?? [], cases: cases ?? [], accreditation } : null;
}

export async function listAdminApplications(params: AdminListParams = {}) {
  await requireAdmin();
  const admin = createUntypedClient();
  let query = admin.from("applications").select("id, status, full_name, renter_id, listing_id, created_at, listing:listings(title, address)").order("created_at", { ascending: false }).limit(boundedAdminLimit(params.limit));
  if (params.status) query = query.eq("status", params.status);
  if (params.cursor) query = query.lt("created_at", params.cursor);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load applications.");
  return (data ?? []).map((application) => ({ ...application, listing: singleRelation(application.listing) }));
}

export async function listAdminViewings(params: AdminListParams = {}) {
  await requireAdmin();
  const admin = createUntypedClient();
  let query = admin.from("viewings").select("id, status, created_at, application:applications(id, full_name, listing:listings(title, address)), slot:viewing_slots(start_time, end_time, viewing_mode)").order("created_at", { ascending: false }).limit(boundedAdminLimit(params.limit));
  if (params.status) query = query.eq("status", params.status);
  if (params.cursor) query = query.lt("created_at", params.cursor);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load viewings.");
  return (data ?? []).map((viewing) => {
    const application = singleRelation(viewing.application);
    return {
      ...viewing,
      application: application ? { ...application, listing: singleRelation(application.listing) } : null,
      slot: singleRelation(viewing.slot),
    };
  });
}

export async function listAdminOperations(params: AdminListParams = {}) {
  await requireAdmin();
  const admin = createUntypedClient();
  let query = admin.from("notification_events").select("id, recipient_id, type, attempt_count, sent_at, digest_at, next_attempt_at, last_error, locked_at, created_at").order("created_at", { ascending: false }).limit(boundedAdminLimit(params.limit));
  if (params.status === "failed") query = query.is("sent_at", null).not("last_error", "is", null);
  if (params.status === "queued") query = query.is("sent_at", null).is("last_error", null);
  if (params.status === "sent") query = query.not("sent_at", "is", null);
  if (params.cursor) query = query.lt("created_at", params.cursor);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load notification operations.");
  return data ?? [];
}

export async function listAdminAudit(params: AdminListParams = {}) {
  await requireAdmin();
  const admin = createUntypedClient();
  let query = admin.from("admin_audit_events").select("id, actor_id, action_key, target_type, target_id, reason, request_id, metadata, created_at").order("created_at", { ascending: false }).limit(boundedAdminLimit(params.limit));
  if (params.q) query = query.or(`action_key.ilike.%${params.q}%,target_type.ilike.%${params.q}%`);
  if (params.cursor) query = query.lt("created_at", params.cursor);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load audit history.");
  return data ?? [];
}

export async function listAdminMembers() {
  await requireAdmin({ ownerOnly: true });
  const admin = createUntypedClient();
  const { data, error } = await admin.from("admin_memberships").select("*").order("created_at");
  if (error) throw new Error("Unable to load admin members.");
  const ids = (data ?? []).map((membership) => membership.user_id);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] };
  const factorsByUser = new Map<string, { id: string; friendly_name?: string | null; status?: string }[]>();
  await Promise.all(ids.map(async (userId) => {
    const { data: factorData } = await admin.auth.admin.mfa.listFactors({ userId });
    factorsByUser.set(userId, factorData?.factors ?? []);
  }));
  return (data ?? []).map((membership) => ({
    ...membership,
    profile: profiles?.find((profile) => profile.id === membership.user_id) ?? null,
    factors: factorsByUser.get(membership.user_id) ?? [],
  }));
}
