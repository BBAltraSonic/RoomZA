import "server-only";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { z } from "zod";
import { safeRedirectPath } from "@/lib/redirects";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import { confirmEntryPermission, decideEntry } from "./publication-data";

function json(body:unknown,status=200){return Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
export async function handleEntryPublicationWrite(request:Request,review=false){
  if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"This request must come from this site."},403);
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return json({error:"Send a JSON request."},415);
  try{
    if(review)await requireAdmin({redirectTo:"/admin/entries"});else await requireUser({redirectTo:"/post/entries"});
    const body=await request.text();if(new TextEncoder().encode(body).length>12000)return json({error:"Review is too long."},413);
    let input:unknown;try{input=JSON.parse(body);}catch{return json({error:"Invalid request."},400);}
    return json(review?await decideEntry(input):await confirmEntryPermission(input));
  }catch(error){
    if(isRedirectError(error)){const nextPath=safeRedirectPath(getURLFromRedirectError(error),review?"/admin/entries":"/post/entries");return json({error:"Your account needs attention before continuing.",nextPath},nextPath.startsWith("/auth?")?401:403);}
    if(error instanceof z.ZodError)return json({error:"Complete the required confirmation or review fields."},400);
    const code=error&&typeof error==="object"&&"code"in error?error.code:null;
    if(code==="PT409")return json({error:"This entry changed. Your text is retained; load the latest version before continuing."},409);
    if(code==="42501")return json({error:"Current poster or reviewer access is required."},403);
    if(code==="22023")return json({error:"Check revision permission, location, dates and review evidence."},400);
    return json({error:"Could not complete this request. Check the latest version before retrying."},503);
  }
}
