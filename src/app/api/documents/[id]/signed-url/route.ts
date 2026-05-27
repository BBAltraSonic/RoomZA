import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DocumentRecord = {
  id: string;
  file_url: string;
  path?: string | null;
  bucket?: string | null;
  application_id: string;
  application:
    | {
        renter_id: string;
        listing: { landlord_id: string } | { landlord_id: string }[] | null;
      }
    | {
        renter_id: string;
        listing: { landlord_id: string } | { landlord_id: string }[] | null;
      }[]
    | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

  const document = data as unknown as DocumentRecord;
  const application = first(document.application);
  const listing = first(application?.listing);
  const isRenter = application?.renter_id === user.id;
  const isLandlord = listing?.landlord_id === user.id;

  if (!isRenter && !isLandlord) {
    logger.warn("Unauthorized document signed URL attempt", { requestId, documentId: id, userId: user.id });
    return apiFailure({ code: "forbidden", message: "You do not have access to this document." }, 403, { requestId });
  }

  const admin = createAdminClient();
  const bucket = document.bucket || "application-documents";
  const path = document.path || document.file_url;
  const { data: signedUrl, error: signedUrlError } = await admin.storage.from(bucket).createSignedUrl(path, 60);

  if (signedUrlError || !signedUrl?.signedUrl) {
    logger.error("Document signed URL creation failed", { requestId, documentId: id, error: signedUrlError });
    return apiFailure({ code: "server_error", message: "Unable to create document link." }, 500, { requestId });
  }

  return apiSuccess({ url: signedUrl.signedUrl, expiresIn: 60 }, { requestId });
}
