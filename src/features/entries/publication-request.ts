"use client";
import { safeRedirectPath } from "@/lib/redirects";
import type { EntryDecision } from "./publication-contract";
import type { z } from "zod";
import type { entryPermissionCommandSchema } from "./publication-contract";
export async function requestEntryPublication(command: EntryDecision | z.infer<typeof entryPermissionCommandSchema>, review=false) {
  const response=await fetch(review?"/api/private/entries/review":"/api/private/entries/permission",{
    method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(command),
  });
  const result=await response.json();
  if(!response.ok)return {ok:false as const,status:response.status,message:typeof result.error==="string"?result.error:"Could not complete this request.",
    nextPath:typeof result.nextPath==="string"?safeRedirectPath(result.nextPath,review?"/admin/entries":"/post/entries"):undefined};
  return {ok:true as const,data:result as unknown};
}
