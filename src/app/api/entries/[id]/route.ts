import { z } from "zod";
import { readPublicEntryDetail } from "@/features/entries/public-data";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const id=z.string().uuid().safeParse((await params).id),headers={"Cache-Control":"no-store"};
  if(!id.success)return Response.json({error:"Invalid special link."},{status:400,headers});
  try{const result=await readPublicEntryDetail(id.data);return Response.json(result,{status:result.item?200:404,headers});}
  catch{return Response.json({error:"This special could not be checked."},{status:503,headers});}
}
