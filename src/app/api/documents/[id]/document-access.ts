import { z } from "zod";

/**
 * Runtime validation + authorization for document signed-URL access.
 *
 * This route mints a signed URL with the SERVICE-ROLE (RLS-bypassing) client,
 * so the participant check here is the authoritative gate — not a convenience.
 * The data shape is therefore *validated* at runtime rather than asserted with
 * a cast, so a future schema/join change can't silently weaken the guard.
 *
 * Supabase can surface a `to-one` relation as either an object or a
 * single-element array depending on the query, so relations are normalized
 * with `firstOrNull` before validation.
 */

const firstOrNull = (value: unknown) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

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

/**
 * Pure access decision for a fetched document row.
 *
 * - `malformed`: the row failed validation — treated as not-found by the route
 *   so we never hand an unverified shape to the signed-URL minter.
 * - `forbidden`: the requester is neither the renter on the application nor the
 *   landlord on the listing.
 * - `ok`: returns the resolved storage `bucket`/`path` and the granting role.
 */
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

    return {
        ok: true,
        bucket: doc.bucket || DEFAULT_BUCKET,
        path: doc.path || doc.file_url,
        role: isRenter ? "renter" : "landlord",
    };
}
