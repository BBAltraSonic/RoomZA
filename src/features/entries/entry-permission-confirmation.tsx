"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWorkspaceReady } from "@/features/offers/use-workspace-ready";
import type { EntryCategory } from "./schema";
import { entryPermissionResultSchema } from "./publication-contract";
import { requestEntryPublication } from "./publication-request";
export function EntryPermissionConfirmation({entryId,category,revisionId,version,confirmed}:{entryId:string;category:EntryCategory;revisionId:string;version:number;confirmed:boolean}){
  const router=useRouter(),ready=useWorkspaceReady(),inFlight=useRef(false);
  const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(confirmed),[error,setError]=useState(""),[blocked,setBlocked]=useState(false),[next,setNext]=useState<string>();
  async function confirm(){if(inFlight.current||!checked||blocked)return;inFlight.current=true;setBusy(true);setError("");
    try{const result=await requestEntryPublication({entryId,category,revisionId,expectedVersion:version,permissionConfirmed:true});
      if(!result.ok){setError(result.message);setNext(result.nextPath);if([401,403,409].includes(result.status))setBlocked(true);return;}
      const data=entryPermissionResultSchema.parse(result.data);if(data.entryId!==entryId||data.revisionId!==revisionId||data.version!==version)throw new Error();
      setDone(true);router.refresh();
    }catch{setError("Could not confirm permission. Check the latest version before retrying.");}finally{inFlight.current=false;setBusy(false);}
  }
  return <section aria-label="Publishing permission" className="space-y-3 rounded-2xl border border-border bg-panel p-5">
    <h2 className="text-lg font-semibold">Publishing permission</h2>
    {done?<p role="status" className="text-sm">Permission confirmed for this submitted revision. An administrator must still check and approve it.</p>:<>
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={checked} disabled={!ready||busy||blocked} onChange={event=>setChecked(event.target.checked)} className="mt-1 size-4"/><span>I have authority to publish this submitted venue and content, and permission for Pinpoint to display it publicly.</span></label>
      <Button type="button" className="min-h-11" disabled={!ready||!checked||busy||blocked} onClick={()=>void confirm()}>{busy?"Confirming…":"Confirm publishing permission"}</Button>
    </>}
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
    {blocked?<Button variant="outline" onClick={()=>window.location.reload()}>Load latest version</Button>:null}
    {next?<Link href={next} className="inline-flex min-h-11 items-center text-forest underline">Continue account checks</Link>:null}
  </section>;
}
