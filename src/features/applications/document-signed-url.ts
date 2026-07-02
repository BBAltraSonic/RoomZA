import { resolveDocumentAccess } from "@/features/applications/document-access";
import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DocumentSignedUrlResult =
  | { ok: true; url: string; expiresIn: number }
  | { ok: false; code: "unauthorized" | "forbidden" | "not_found" | "server_error"; message: string; httpStatus: number };

const SIGNED_URL_EXPIRES_IN_SECONDS = 60;

export async function createDocumentSignedUrl(documentId: string, requestId: string): Promise<DocumentSignedUrlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "unauthorized", message: "Authentication is required.", httpStatus: 401 };
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, file_url, path, bucket, application_id, application:applications(renter_id, listing:listings(landlord_id))")
    .eq("id", documentId)
    .single();

  if (error || !data) {
    logger.warn("Document metadata lookup failed", { requestId, documentId, error });
    return { ok: false, code: "not_found", message: "Document not found.", httpStatus: 404 };
  }

  const access = resolveDocumentAccess(data, user.id);
  if (!access.ok) {
    if (access.reason === "malformed") {
      logger.error("Document row failed validation", { requestId, documentId });
      return { ok: false, code: "not_found", message: "Document not found.", httpStatus: 404 };
    }

    logger.warn("Unauthorized document signed URL attempt", { requestId, documentId, userId: user.id });
    return { ok: false, code: "forbidden", message: "You do not have access to this document.", httpStatus: 403 };
  }

  const admin = createAdminClient();
  const { data: signedUrl, error: signedUrlError } = await admin.storage
    .from(access.bucket)
    .createSignedUrl(access.path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (signedUrlError || !signedUrl?.signedUrl) {
    logger.error("Document signed URL creation failed", { requestId, documentId, error: signedUrlError });
    return { ok: false, code: "server_error", message: "Unable to create document link.", httpStatus: 500 };
  }

  return { ok: true, url: signedUrl.signedUrl, expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS };
}
