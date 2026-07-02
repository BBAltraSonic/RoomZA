export const MAX_APPLICATION_DOCUMENTS = 20;
export const MAX_APPLICATION_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_APPLICATION_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type ApplicationDocumentInput = {
  field: string;
  file: File;
};

export function validateApplicationDocuments(documents: ApplicationDocumentInput[]) {
  const fieldErrors: Record<string, string[]> = {};

  if (documents.length > MAX_APPLICATION_DOCUMENTS) {
    fieldErrors._form = [`Upload no more than ${MAX_APPLICATION_DOCUMENTS} documents per application.`];
  }

  for (const document of documents) {
    if (!ALLOWED_APPLICATION_DOCUMENT_TYPES.includes(document.file.type as (typeof ALLOWED_APPLICATION_DOCUMENT_TYPES)[number])) {
      fieldErrors[document.field] = ["Documents must be PDF, JPEG, or PNG files."];
      continue;
    }

    if (document.file.size > MAX_APPLICATION_DOCUMENT_BYTES) {
      fieldErrors[document.field] = ["Document must be 10 MB or smaller."];
    }
  }

  return Object.keys(fieldErrors).length === 0
    ? { valid: true as const }
    : { valid: false as const, fieldErrors };
}
