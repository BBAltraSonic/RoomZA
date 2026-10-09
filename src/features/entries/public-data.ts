import "server-only";
import { z } from "zod";
import { createClient,type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import type { Database,Json } from "@/lib/supabase/types";
import { entryCategorySchema,type EntryCategory } from "./schema";
import { publicEntryFeedSchema,publicEntryDetailSchema } from "./public-contract";
type PublicDatabase=Omit<Database,"public">&{public:Omit<Database["public"],"Functions">&{Functions:Database["public"]["Functions"]&{
  pinpoint_entry_public_feed:{Args:{category:EntryCategory;area:string;page:number};Returns:Json};
  pinpoint_entry_public_detail:{Args:{target:string};Returns:Json};
}}};
function anonymous(){const {supabaseUrl,supabaseAnonKey}=getSupabaseEnv();return createClient<PublicDatabase>(supabaseUrl,supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store",signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(4000)]):AbortSignal.timeout(4000)})}});}
export async function readPublicEntryFeed(category:EntryCategory,areaId:string,page=1){
  const requestedCategory=entryCategorySchema.parse(category),area=z.string().uuid().parse(areaId);z.number().int().min(1).max(10000).parse(page);
  const {data,error}=await(anonymous()as SupabaseClient<PublicDatabase>).rpc("pinpoint_entry_public_feed",{category:requestedCategory,area,page});
  if(error)throw error;const result=publicEntryFeedSchema.parse(data);
  if(result.category!==requestedCategory||result.areaId!==area||result.page!==page)throw new Error("Entry feed response mismatch");return result;
}
export async function readPublicEntryDetail(entryId:string){
  const target=z.string().uuid().parse(entryId),{data,error}=await anonymous().rpc("pinpoint_entry_public_detail",{target});
  if(error)throw error;const result=publicEntryDetailSchema.parse(data);
  if(result.item&&result.item.entryId!==target)throw new Error("Entry detail response mismatch");return result;
}
