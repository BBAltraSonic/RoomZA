import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveDocumentAccess } from "../document-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiFailure({ code: "unauthorized", message: "Authentication is required." }, 401, { requestId });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, file_url, path, bucket, application_id, application:applications(renter_id, listing:listings(landlord_id))")
    .eq("id", id)
    .single();

  if (error || !data) {
    logger.warn("Document metadata lookup failed", { requestId, documentId: id, error });
    return apiFailure({ code: "not_found", message: "Document not found." }, 404, { requestId });
  }

  const access = resolveDocumentAccess(data, user.id);

  if (!access.ok) {
    if (access.reason === "malformed") {
      // The row failed validation — never hand an unverified shape to the
      // service-role signed-URL minter. Treat as not found.
      logger.error("Document row failed validation", { requestId, documentId: id });
      return apiFailure({ code: "not_found", message: "Document not found." }, 404, { requestId });
    }
    logger.warn("Unauthorized document signed URL attempt", { requestId, documentId: id, userId: user.id });
    return apiFailure({ code: "forbidden", message: "You do not have access to this document." }, 403, { requestId });
  }

  const admin = createAdminClient();
  const { data: signedUrl, error: signedUrlError } = await admin.storage
    .from(access.bucket)
    .createSignedUrl(access.path, 60);

  if (signedUrlError || !signedUrl?.signedUrl) {
    logger.error("Document signed URL creation failed", { requestId, documentId: id, error: signedUrlError });
    return apiFailure({ code: "server_error", message: "Unable to create document link." }, 500, { requestId });
  }

  return apiSuccess({ url: signedUrl.signedUrl, expiresIn: 60 }, { requestId });
}
