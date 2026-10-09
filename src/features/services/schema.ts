import { z } from "zod";
export const serviceTypes = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "Gardening",
  "Handyman",
  "Other",
] as const;
export const serviceContentSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    providerName: z.string().trim().min(1).max(160),
    serviceType: z.enum(serviceTypes),
    description: z.string().trim().min(1).max(4000),
    areaId: z.string().uuid(),
    address: z.string().trim().min(1).max(500),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,24}$/),
  })
  .strict();
export const serviceDraftSchema = serviceContentSchema.partial();
export type ServiceContent = z.infer<typeof serviceContentSchema>;
export type ServiceDraft = z.infer<typeof serviceDraftSchema>;
export const serviceSubmissionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "submitted", "approved", "rejected", "withdrawn"]),
  draft: serviceDraftSchema,
  submitted: serviceContentSchema.nullable(),
  updated_at: z.string(),
});
export const publicServiceSchema = z.object({
  id: z.string().uuid(),
  area_id: z.string().uuid(),
  content: serviceContentSchema,
  approved_at: z.string(),
});
export const serviceFeedSchema = z.object({
  areaId: z.string().uuid(),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  items: z.array(publicServiceSchema).max(20),
  hasNext: z.boolean(),
});
export type ServiceFeed = z.infer<typeof serviceFeedSchema>;
