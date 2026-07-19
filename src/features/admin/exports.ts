import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { createUntypedClient } from "@/lib/supabase/admin";

import { requireAdmin } from "./auth";
import { toCsv } from "./csv";

export async function exportAuditCsv(request: NextRequest) {
  await requireAdmin({ ownerOnly: true, redirectTo: request.nextUrl.pathname });
  const admin = createUntypedClient();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  let query = admin.from("admin_audit_events").select("id, actor_id, action_key, target_type, target_id, reason, request_id, metadata, created_at").order("created_at", { ascending: false }).limit(10_000);
  if (q) query = query.or(`action_key.ilike.%${q}%,target_type.ilike.%${q}%`);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Unable to export audit events." }, { status: 500 });
  const csv = toCsv(["id", "created_at", "actor_id", "action", "target_type", "target_id", "reason", "request_id", "metadata"], (data ?? []).map((item) => [item.id, item.created_at, item.actor_id, item.action_key, item.target_type, item.target_id, item.reason, item.request_id, item.metadata]));
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="roomza-admin-audit.csv"', "cache-control": "private, no-store" } });
}

export async function exportCasesCsv(request: NextRequest) {
  await requireAdmin({ ownerOnly: true, redirectTo: request.nextUrl.pathname });
  const admin = createUntypedClient();
  const status = request.nextUrl.searchParams.get("status");
  const priority = request.nextUrl.searchParams.get("priority");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  let query = admin.from("moderation_cases").select("id, reporter_id, listing_id, reported_user_id, message_id, listing_image_id, category, status, priority, assigned_to, resolution_note, created_at, updated_at, resolved_at").order("created_at", { ascending: false }).limit(10_000);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Unable to export moderation cases." }, { status: 500 });
  const csv = toCsv(["id", "created_at", "status", "priority", "category", "reporter_id", "listing_id", "reported_user_id", "message_id", "listing_image_id", "assigned_to", "resolution_note", "resolved_at"], (data ?? []).map((item) => [item.id, item.created_at, item.status, item.priority, item.category, item.reporter_id, item.listing_id, item.reported_user_id, item.message_id, item.listing_image_id, item.assigned_to, item.resolution_note, item.resolved_at]));
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="roomza-moderation-cases.csv"', "cache-control": "private, no-store" } });
}
