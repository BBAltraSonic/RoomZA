import { z } from "zod";
import { publicLiveOfferSchema } from "@/features/offers/public-contract";
import { publicEntrySchema } from "@/features/entries/public-contract";
import { publicServiceSchema, serviceTypes } from "@/features/services/schema";

export const viewportCategorySchema = z.enum(["shopping", "tourism", "event", "service"]);
export type ViewportCategory = z.infer<typeof viewportCategorySchema>;
export const boundsSchema = z.object({
  west: z.number().finite().min(-180).max(180), south: z.number().finite().min(-85).max(85),
  east: z.number().finite().min(-180).max(180), north: z.number().finite().min(-85).max(85),
}).strict().refine(b => b.west < b.east && b.south < b.north, "Invalid map bounds");
export function parseViewportBbox(value: string | null) {
  if (!value || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(value)) return null;
  const [west, south, east, north] = value.split(",").map(Number);
  const parsed = boundsSchema.safeParse({ west, south, east, north });
  return parsed.success ? parsed.data : null;
}
export const formatViewportBbox = (b: z.infer<typeof boundsSchema>) => [b.west,b.south,b.east,b.north].map(n => Number(n.toFixed(9))).join(",");
export const viewportQuerySchema = z.object({
  category: viewportCategorySchema, bounds: boundsSchema,
  q: z.string().trim().max(120).default(""),
  sort: z.enum(["Ending soon", "Latest", "Nearest"]),
  serviceType: z.enum(["All services", ...serviceTypes]).default("All services"),
}).strict().refine(q => q.category !== "service" || q.sort !== "Ending soon", "Invalid service sort")
  .refine(q => q.category === "service" || q.serviceType === "All services", "Invalid category filter");
export type ViewportQuery = z.infer<typeof viewportQuerySchema>;
const base = { bounds: boundsSchema, serverNow: z.string().datetime({ offset: true }), totalCount: z.number().int().nonnegative() };
export const viewportResponseSchema = z.discriminatedUnion("category", [
  z.object({ ...base, category: z.literal("shopping"), items: z.array(publicLiveOfferSchema).max(250) }).strict(),
  z.object({ ...base, category: z.literal("tourism"), items: z.array(publicEntrySchema).max(250) }).strict(),
  z.object({ ...base, category: z.literal("event"), items: z.array(publicEntrySchema).max(250) }).strict(),
  z.object({ ...base, category: z.literal("service"), items: z.array(publicServiceSchema).max(250) }).strict(),
]).superRefine((value, ctx) => {
  if (value.totalCount < value.items.length) ctx.addIssue({ code: "custom", message: "Invalid count" });
  for (const item of value.items) {
    const c = item.content, b = value.bounds;
    if (c.longitude < b.west || c.longitude > b.east || c.latitude < b.south || c.latitude > b.north ||
      ("category" in item && item.category !== value.category)) ctx.addIssue({ code: "custom", message: "Viewport scope mismatch" });
  }
});
export type ViewportResponse = z.infer<typeof viewportResponseSchema>;
