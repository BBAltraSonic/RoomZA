import { z } from "zod";
export const mediaFields = {
  mediaIds: z.array(z.string().uuid()).max(20).refine(ids => new Set(ids).size === ids.length, "Duplicate photos").optional(),
  mediaRightsConfirmed: z.boolean().optional(),
};
export const SPECIAL_PHOTO_LIMIT = 10;
export const specialMediaFields = {
  ...mediaFields,
  mediaIds: mediaFields.mediaIds.unwrap().refine(ids => ids.length <= SPECIAL_PHOTO_LIMIT, "Use up to ten photos.").optional(),
};
export function requireSpecialPhotos(content: { mediaIds?: string[] }) {
  if (!content.mediaIds?.length) throw new Error("Add at least one photo before submitting this Special.");
}
export const dealFields = { priceCents: z.number().int().min(0).max(2147483647).optional(), originalPriceCents: z.number().int().min(1).max(2147483647).optional() };
export function validateDeal(content: { priceCents?: number; originalPriceCents?: number }, ctx: z.RefinementCtx) {
  if (content.originalPriceCents !== undefined && (content.priceCents === undefined || content.originalPriceCents <= content.priceCents)) ctx.addIssue({ code: "custom", path: ["originalPriceCents"], message: "Original price must be higher than the special price." });
}
export function requireMediaRights(content: { mediaIds?: string[]; mediaRightsConfirmed?: boolean }) {
  if (content.mediaIds?.length && !content.mediaRightsConfirmed) throw new Error("Confirm that you may publish these photos.");
}
export const publicMediaSchema = z.array(z.object({ id: z.string().uuid(), url: z.string().url() }).strict()).max(20);
export const publicPresentationFields = { media: publicMediaSchema.optional(), savedCount: z.number().int().nonnegative().optional() };
export function formatDealPrice(cents: number) {
  if (cents === 0) return "Free";
  return "R" + new Intl.NumberFormat("en-ZA", { maximumFractionDigits: cents % 100 ? 2 : 0, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
export function discountPercent(price?: number, original?: number) { return price !== undefined && original !== undefined && original > price ? Math.round((1 - price / original) * 100) : null; }
export function parseRandInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a rand price with at most two decimal places.");
  const [rand, fraction = ""] = value.trim().split(".");
  return z.number().int().min(0).max(2147483647).parse(Number(rand) * 100 + Number(fraction.padEnd(2, "0")));
}
