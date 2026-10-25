import { z } from "zod";
import { isOwnedStoragePath } from "@/lib/storage-references";

const firstOrNull = (value: unknown) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

const documentListingSchema = z.object({ landlord_id: z.string().min(1) });

const documentApplicationSchema = z.object({
  renter_id: z.string().min(1),
  listing: z.preprocess(firstOrNull, documentListingSchema.nullable()),
});

export const documentRecordSchema = z.object({
  id: z.string().min(1),
  file_url: z.string().min(1),
  path: z.string().nullable().optional(),
  bucket: z.string().nullable().optional(),
  application_id: z.string().min(1),
  application: z.preprocess(firstOrNull, documentApplicationSchema.nullable()),
});

export type DocumentRecord = z.infer<typeof documentRecordSchema>;

export type DocumentAccess =
  | { ok: true; bucket: string; path: string; role: "renter" | "landlord" }
  | { ok: false; reason: "malformed" | "forbidden" };

const DEFAULT_BUCKET = "application-documents";
const documentStorageSchema = z.object({bucket:z.string().nullish(),path:z.string().nullish(),file_url:z.string().nullish()});

export function resolveApplicationDocumentStorage(row: unknown, renterId: string) {
  const parsed = documentStorageSchema.safeParse(row);
  if (!parsed.success) return null;
  const bucket = parsed.data.bucket || DEFAULT_BUCKET;
  const path = parsed.data.path || parsed.data.file_url;
  return bucket === DEFAULT_BUCKET && isOwnedStoragePath(path,renterId) ? {bucket,path} : null;
}

export function resolveDocumentAccess(row: unknown, userId: string): DocumentAccess {
  const parsed = documentRecordSchema.safeParse(row);
  if (!parsed.success) {
    return { ok: false, reason: "malformed" };
  }

  const doc = parsed.data;
  const application = doc.application;
  const listing = application?.listing ?? null;

  const isRenter = !!userId && application?.renter_id === userId;
  const isLandlord = !!userId && listing?.landlord_id === userId;

  if (!isRenter && !isLandlord) {
    return { ok: false, reason: "forbidden" };
  }

  // Party membership does not make user-controlled storage references trusted.
  // All application uploads use the renter's namespace in this private bucket.
  const storage = resolveApplicationDocumentStorage(doc,application?.renter_id ?? "");
  if (!storage) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    ...storage,
    role: isRenter ? "renter" : "landlord",
  };
}
