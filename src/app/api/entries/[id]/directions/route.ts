import { z } from "zod";
import { readPublicEntryDetail } from "@/features/entries/public-data";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const id=z.string().uuid().safeParse((await params).id),headers={"Cache-Control":"no-store"};
  if(!id.success)return Response.json({error:"Invalid special link."},{status:400,headers});
  try{const {item,serverNow}=await readPublicEntryDetail(id.data);if(!item)return Response.json({error:"This special is unavailable."},{status:404,headers});
    const destination=new URL("https://www.google.com/maps/dir/");destination.searchParams.set("api","1");destination.searchParams.set("destination",`${item.content.latitude},${item.content.longitude}`);
    return Response.json({url:destination.href,endsAt:item.content.endsAt,serverNow},{headers});
  }catch{return Response.json({error:"Directions could not be checked. Try again."},{status:503,headers});}
}
