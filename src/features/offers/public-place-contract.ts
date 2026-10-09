import { z } from "zod";

export const offerDiscoveryPlaceSchema = z.object({
  id: z.string().uuid(), providerId: z.string(), label: z.string(), secondaryLabel: z.string(), fullAddress: z.string(),
  center: z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }).strict(),
  bounds: z.object({ west: z.number().finite().min(-180).max(180), south: z.number().finite().min(-90).max(90), east: z.number().finite().min(-180).max(180), north: z.number().finite().min(-90).max(90) }).strict(),
}).strict();
export const offerPlacesResponseSchema = z.object({ data: z.object({ places: z.array(offerDiscoveryPlaceSchema).max(6) }).strict() }).strict();
