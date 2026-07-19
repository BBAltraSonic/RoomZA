import { NextResponse } from "next/server";
import { z } from "zod";

import { apiFailure, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) return apiFailure({ code: "bad_request", message: "Invalid export." }, 400, { requestId });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiFailure({ code: "unauthorized", message: "Sign in to download this export." }, 401, { requestId });
  const admin = createUntypedClient();
  const { data } = await admin.from("privacy_requests").select("artifact_bucket, artifact_path, artifact_expires_at, status").eq("id", parsed.data).eq("user_id", user.id).eq("request_type", "export").maybeSingle();
  if (!data?.artifact_path || !data.artifact_bucket || data.status !== "completed" || !data.artifact_expires_at || new Date(data.artifact_expires_at) <= new Date()) return apiFailure({ code: "not_found", message: "This export is unavailable or expired." }, 404, { requestId });
  const { data: signed, error } = await admin.storage.from(data.artifact_bucket).createSignedUrl(data.artifact_path, 60, { download: `pinpoint-data-${parsed.data.slice(0, 8)}.zip` });
  if (error || !signed?.signedUrl) return apiFailure({ code: "server_error", message: "The download link could not be created." }, 500, { requestId });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
}
