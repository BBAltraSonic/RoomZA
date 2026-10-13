import { z } from "zod";
export const notificationCategories = ["messages", "applications", "viewings", "offers", "saved_searches", "security", "account_updates", "reviews", "verification"] as const;
export const notificationCategoryLabels: Record<(typeof notificationCategories)[number],string>={messages:"Messages",applications:"Applications",viewings:"Viewings and tours",offers:"Listings and saved items",saved_searches:"Saved searches",security:"Security",account_updates:"Account and organizations",reviews:"Reviews",verification:"Verification and documents"};
export const categorySchema = z.enum(notificationCategories);
export const notificationQuerySchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  beforeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  unread: z.enum(["true", "false"]).optional(),
  category: categorySchema.optional(),
}).strict().refine(v => Boolean(v.before) === Boolean(v.beforeId), "A complete cursor is required");
export const notificationMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("archive"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("read_all"), through: z.string().datetime({ offset: true }) }).strict(),
]);
export const notificationOptionsSchema = z.object({
  previews: z.boolean(), quietEnabled: z.boolean(),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().max(80).refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Invalid timezone"),
}).strict().refine(v => !v.quietEnabled || v.quietStart !== v.quietEnd, "Quiet hours must differ");
export const defaultNotificationOptions = { previews: true, quietEnabled: false, quietStart: "21:00", quietEnd: "08:00", timezone: "Africa/Johannesburg" };
export function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && (
      url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" ||
      url.hostname === "web.push.apple.com" || url.hostname.endsWith(".push.apple.com") ||
      url.hostname === "notify.windows.com" || url.hostname.endsWith(".notify.windows.com")
    );
  } catch { return false; }
}
export const pushRegistrationSchema = z.object({
  endpoint: z.string().max(2048).refine(isAllowedPushEndpoint, "Unsupported push service"),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/) }).strict(),
  label: z.string().trim().min(1).max(80),
}).strict();
export function isInQuietHours(options: typeof defaultNotificationOptions, now = new Date()) {
  if (!options.quietEnabled) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: options.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const local = parts.find(p => p.type === "hour")?.value + ":" + parts.find(p => p.type === "minute")?.value;
  return options.quietStart < options.quietEnd ? local >= options.quietStart && local < options.quietEnd : local >= options.quietStart || local < options.quietEnd;
}
