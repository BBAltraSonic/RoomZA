import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createProfileDocumentSignedUrl } from "@/features/profile/data";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ versionId: z.string().uuid() });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const requestId = getRequestId(request);
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success)
    return apiFailure(
      { code: "validation_failed", message: "Invalid document version." },
      400,
      { requestId },
    );
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return apiFailure(
      { code: "unauthorized", message: "Sign in to open this document." },
      401,
      { requestId },
    );

  const claims = await supabase.auth.getClaims();
  const sessionId = z.string().uuid().safeParse(claims.data?.claims.session_id);
  if (claims.error || claims.data?.claims.sub !== user.id || !sessionId.success) {
    return apiFailure({ code: "unauthorized", message: "Sign in again to open this document." }, 401, { requestId });
  }

  const result = await createProfileDocumentSignedUrl(
    user.id,
    sessionId.data,
    parsed.data.versionId,
    requestId,
  );

  if ("error" in result) {
    if (result.error === "not_found") {
      return apiFailure(
        { code: "not_found", message: "Document version not found." },
        404,
        { requestId },
      );
    }
    if (result.error === "forbidden") {
      return apiFailure(
        { code: "forbidden", message: "You do not have access to this document." },
        403,
        { requestId },
      );
    }
    return apiFailure(
      { code: "server_error", message: "A secure document link could not be created." },
      500,
      { requestId },
    );
  }

  return apiSuccess(
    { url: result.signedUrl, expiresIn: result.expiresIn },
    {
      requestId,
      headers: { "cache-control": "private, no-store" },
    },
  );
}
