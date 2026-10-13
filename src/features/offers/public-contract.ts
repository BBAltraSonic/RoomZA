import { publicPresentationFields } from "@/features/discovery/deal-schema";
import { z } from "zod";
import { offerContentSchema } from "./schema";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const publicPlace = z.object({ id: uuid, name: z.string(), region: z.string(), fullAddress: z.string() }).strict();
const publicPoster = z.object({ username: z.string(), displayName: z.string() }).strict().nullable();
const reviewed = { offerId: uuid, revisionId: uuid, confirmedAt: timestamp, startsAt: timestamp, endsAt: timestamp, areaId: uuid };
export const publicLiveOfferSchema = z.object({ ...publicPresentationFields, ...reviewed, status: z.literal("live"), content: offerContentSchema, place: publicPlace, poster: publicPoster }).strict();
const inactiveOffer = z.object({ ...reviewed, status: z.enum(["scheduled", "expired"]), content: z.null(), place: z.null(), poster: z.null() }).strict();
export const publicOfferDetailSchema = z.union([
  publicLiveOfferSchema.extend({ serverNow: timestamp }),
  inactiveOffer.extend({ serverNow: timestamp }),
  z.object({ status: z.literal("unavailable"), serverNow: timestamp }).strict(),
]);
export const publicOfferCursorSchema = z.object({ confirmedAt: timestamp, offerId: uuid }).strict();
export const publicOfferFeedSchema = z.object({ serverNow: timestamp, areaId: uuid, totalCount: z.number().int().nonnegative(), items: z.array(publicLiveOfferSchema).max(20), nextCursor: publicOfferCursorSchema.nullable() }).strict();
export const publicOfferCountSchema = publicOfferFeedSchema.pick({ areaId: true, serverNow: true, totalCount: true });
export const publicOfferActionSchema = z.object({ offerId: uuid, revisionId: uuid, serverNow: timestamp, endsAt: timestamp, shopName: z.string(), address: z.string(), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict().nullable();
export type PublicLiveOffer = z.infer<typeof publicLiveOfferSchema>;
export type PublicOfferCursor = z.infer<typeof publicOfferCursorSchema>;
export type PublicOfferDetail = z.infer<typeof publicOfferDetailSchema>;
export const publicOfferDirectionsSchema = z.object({
  destination: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.origin === "https://www.google.com" && url.pathname === "/maps/dir/" &&
      url.searchParams.get("api") === "1" && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(url.searchParams.get("destination") ?? "") &&
      [...url.searchParams.keys()].length === 2 && !url.hash && !url.username && !url.password;
  }),
  serverNow: timestamp,
  endsAt: timestamp,
}).strict();
