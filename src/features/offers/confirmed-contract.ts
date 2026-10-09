import { z } from "zod";
export const confirmedOfferCursorSchema = z.object({ confirmedAt: z.string().datetime({ offset: true }), offerId: z.string().uuid() }).strict();
export const confirmedOfferQueueSchema = z.object({
  checkedAt: z.string().datetime({ offset: true }),
  items: z.array(z.object({
    offerId: z.string().uuid(), version: z.number().int().positive(), revisionId: z.string().uuid(),
    title: z.string().min(1).max(160), shopName: z.string().min(1).max(160), confirmedAt: z.string().datetime({ offset: true }),
    publicStatus: z.enum(["live", "scheduled", "expired", "unavailable"]),
  }).strict()).max(20),
  nextCursor: confirmedOfferCursorSchema.nullable(),
}).strict();
export type ConfirmedOfferCursor = z.infer<typeof confirmedOfferCursorSchema>;
