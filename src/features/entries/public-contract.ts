import { z } from "zod";
import { entryCategorySchema,entryContentSchema } from "./schema";
export const publicEntrySchema=z.object({entryId:z.string().uuid(),category:entryCategorySchema,content:entryContentSchema,
  approvedAt:z.string().datetime({offset:true}),state:z.enum(["upcoming","live"])}).strict();
export type PublicEntry=z.infer<typeof publicEntrySchema>;
export const publicEntryFeedSchema=z.object({category:entryCategorySchema,areaId:z.string().uuid(),page:z.number().int().positive(),
  totalCount:z.number().int().nonnegative(),items:z.array(publicEntrySchema).max(20),hasNext:z.boolean(),serverNow:z.string().datetime({offset:true})}).strict()
  .superRefine((feed,ctx)=>{if(feed.items.some(item=>item.category!==feed.category||item.content.areaId!==feed.areaId))ctx.addIssue({code:"custom",message:"Entry feed scope mismatch"});});
export type PublicEntryFeed=z.infer<typeof publicEntryFeedSchema>;
export const publicEntryDetailSchema=z.object({item:publicEntrySchema.nullable(),serverNow:z.string().datetime({offset:true})}).strict();
export const entryDirectionsSchema=z.object({url:z.string().url(),endsAt:z.string().datetime({offset:true}),serverNow:z.string().datetime({offset:true})}).strict()
  .superRefine((value,ctx)=>{const url=new URL(value.url);if(url.origin!=="https://www.google.com"||url.pathname!=="/maps/dir/"||url.searchParams.get("api")!=="1"||!/^[-\d.]+,[-\d.]+$/.test(url.searchParams.get("destination")??""))ctx.addIssue({code:"custom",message:"Invalid venue directions"});});
