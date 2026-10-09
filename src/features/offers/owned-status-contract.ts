import { z } from "zod";
const timestamp = z.string().datetime({ offset: true });
export const ownedOfferStatusSchema = z.object({
  offerId: z.string().uuid(), version: z.number().int().positive(), checkedAt: timestamp,
  status: z.enum(["draft", "pending", "withdrawn", "live", "scheduled", "expired", "unavailable", "unpublished", "needs_confirmation"]),
  revisionId: z.string().uuid().nullable(), confirmedAt: timestamp.nullable(), startsAt: timestamp.nullable(), endsAt: timestamp.nullable(),
}).strict();
export type OwnedOfferPublication = Omit<z.infer<typeof ownedOfferStatusSchema>, "offerId" | "version">;
export const ownedOfferStatusBatchSchema = z.array(ownedOfferStatusSchema).min(1).max(20);
export const ownedOfferStatusLabels: Record<OwnedOfferPublication["status"], string> = {
  draft: "Private draft", pending: "Awaiting admin confirmation", withdrawn: "Withdrawn", live: "Live",
  scheduled: "Confirmed, starts later", expired: "Expired", unavailable: "Confirmed, currently unavailable",
  unpublished: "Removed by admin", needs_confirmation: "Needs fresh confirmation",
};
