import { z } from "zod";
export const specialUrlSchema = z.string().trim().max(2048).url().refine(value => {
  try {
    const url = new URL(value);
    return /^https:\/\//i.test(value) && url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password && !/[\s\\]/.test(value);
  } catch { return false; }
}, "Use an absolute HTTPS link without embedded credentials.");
export const specialLinkFields = { visitUrl: specialUrlSchema.optional(), bookingUrl: specialUrlSchema.optional() };
export type SpecialLinks = { visitUrl?: string; bookingUrl?: string };

