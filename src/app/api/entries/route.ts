import { z } from "zod";
import { entryCategorySchema } from "@/features/entries/schema";
import { readPublicEntryFeed } from "@/features/entries/public-data";
function json(body:unknown,status=200){return Response.json(body,{status,headers:{"Cache-Control":"no-store"}});}
export async function GET(request:Request){const params=new URL(request.url).searchParams;
  const category=entryCategorySchema.safeParse(params.get("category")),area=z.string().uuid().safeParse(params.get("areaId")),page=z.coerce.number().int().min(1).max(10000).safeParse(params.get("page")??1);
  if(!category.success||!area.success||!page.success)return json({error:"Choose a valid special type, location and page."},400);
  try{return json(await readPublicEntryFeed(category.data,area.data,page.data));}catch{return json({error:"Specials could not be loaded."},503);}
}
