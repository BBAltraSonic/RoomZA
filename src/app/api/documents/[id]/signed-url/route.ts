import { z } from "zod";

import { createDocumentSignedUrl } from "@/features/applications/document-signed-url";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";

const signedUrlParamsSchema = z.object({
  id: z.string().uuid("Invalid document id."),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const parsedParams = signedUrlParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiFailure({ code: "validation_failed", message: "Invalid document id." }, 400, { requestId });
  }

  const result = await createDocumentSignedUrl(parsedParams.data.id, requestId);

  if (!result.ok) {
    return apiFailure({ code: result.code, message: result.message }, result.httpStatus, { requestId });
  }

  return apiSuccess({ url: result.url, expiresIn: result.expiresIn }, { requestId });
}
