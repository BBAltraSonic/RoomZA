import "server-only";

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { createUntypedClient } from "@/lib/supabase/admin";

import { appendAdminAudit } from "./audit";
import { requireAdmin } from "./auth";
import { getActiveSensitiveGrant } from "./sensitive-access";

export async function revealConversation(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caseId = request.nextUrl.searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "A moderation case is required." }, { status: 400 });
  const context = await requireAdmin({ redirectTo: `/admin/reports/${caseId}` });
  const grant = await getActiveSensitiveGrant({ adminId: context.user.id, caseId, resourceType: "conversation", resourceId: id });
  if (!grant) return NextResponse.json({ error: "The sensitive-access grant is missing or expired." }, { status: 403 });
  const admin = createUntypedClient();
  const { data: conversation } = await admin.from("conversations").select("id, listing_id, renter_id, landlord_id, created_at").eq("id", id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const { data: messages, error } = await admin.from("messages").select("id, sender_id, content, created_at").eq("conversation_id", id).order("created_at").limit(500);
  if (error) return NextResponse.json({ error: "Unable to reveal the conversation." }, { status: 500 });
  const requestHeaders = await headers();
  await appendAdminAudit({ actorId: context.user.id, actionKey: "sensitive_access.viewed", targetType: "conversation", targetId: id, reason: grant.reason, requestId: requestHeaders.get("x-request-id") ?? requestHeaders.get("cf-ray"), metadata: { caseId, grantId: grant.id } });
  return NextResponse.json({ conversation, messages: messages ?? [], expiresAt: grant.expires_at }, { headers: { "cache-control": "private, no-store" } });
}

export async function revealDocument(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caseId = request.nextUrl.searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "A moderation case is required." }, { status: 400 });
  const context = await requireAdmin({ redirectTo: `/admin/reports/${caseId}` });
  const grant = await getActiveSensitiveGrant({ adminId: context.user.id, caseId, resourceType: "document", resourceId: id });
  if (!grant) return NextResponse.json({ error: "The sensitive-access grant is missing or expired." }, { status: 403 });
  const admin = createUntypedClient();
  const { data: document } = await admin.from("documents").select("id, type, file_url, path, bucket, application_id, created_at").eq("id", id).maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const { data: signed, error } = await admin.storage.from(document.bucket || "application-documents").createSignedUrl(document.path || document.file_url, 60);
  if (error || !signed?.signedUrl) return NextResponse.json({ error: "Unable to create the document link." }, { status: 500 });
  const requestHeaders = await headers();
  await appendAdminAudit({ actorId: context.user.id, actionKey: "sensitive_access.viewed", targetType: "document", targetId: id, reason: grant.reason, requestId: requestHeaders.get("x-request-id") ?? requestHeaders.get("cf-ray"), metadata: { caseId, grantId: grant.id } });
  return NextResponse.json({ document: { id: document.id, type: document.type, applicationId: document.application_id, createdAt: document.created_at }, signedUrl: signed.signedUrl, expiresIn: 60, grantExpiresAt: grant.expires_at }, { headers: { "cache-control": "private, no-store" } });
}
