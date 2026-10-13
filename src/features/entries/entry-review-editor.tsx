"use client";
import { SpecialLinkPreview } from "@/features/discovery/special-links";
import { MediaReviewPreview } from "@/features/discovery/media-fields";

import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWorkspaceReady } from "@/features/offers/use-workspace-ready";
import { entryIntakeResultSchema } from "./intake-contract";
import type { EntryReviewItem,EntryDecision } from "./publication-contract";
import { requestEntryPublication } from "./publication-request";
export function EntryReviewEditor({item}:{item:EntryReviewItem}){
  const router=useRouter(),ready=useWorkspaceReady(),inFlight=useRef(false);
  const [authority,setAuthority]=useState(""),[location,setLocation]=useState(""),[reason,setReason]=useState(""),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[blocked,setBlocked]=useState(false),[message,setMessage]=useState(""),[next,setNext]=useState<string>();
  const control="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
  async function decide(decision:EntryDecision["decision"]){if(inFlight.current||blocked)return;inFlight.current=true;setBusy(true);setError("");setMessage("");
    try{const target={entryId:item.entryId,category:item.category,expectedVersion:item.version};
      const command:EntryDecision=decision==="approve"?{...target,decision,revisionId:item.revisionId,authorityNotes:authority,locationNotes:location,mediaState:item.content.mediaIds?.length ? "reviewed" : "none",reviewed:true}
        :decision==="reject"?{...target,decision,revisionId:item.revisionId,reason}:{...target,decision,reason};
      const result=await requestEntryPublication(command,true);
      if(!result.ok){setError(result.message);setNext(result.nextPath);if([401,403,409].includes(result.status))setBlocked(true);return;}
      const data=entryIntakeResultSchema.parse(result.data);if(data.entryId!==item.entryId||data.category!==item.category||data.version!==item.version+1)throw new Error();
      setBlocked(true);setMessage(decision==="approve"?"Special approved.":decision==="reject"?"Correction sent; this revision remains private.":"Special unpublished.");router.refresh();
    }catch{setError("Could not save this decision. Your notes are retained; check the latest version.");}finally{inFlight.current=false;setBusy(false);}
  }
  return <div className="space-y-4">
<MediaReviewPreview category={item.category} target={item.entryId} content={item.content} />
<SpecialLinkPreview value={item.content} />
    <fieldset disabled={!ready||busy||blocked} className="space-y-4">
      <legend className="mb-3 font-semibold">Review version {item.version}</legend>
      {item.pending?<><p className="text-sm">{item.permissionConfirmed?"Poster permission confirmed for this revision.":"The poster must confirm publishing permission before approval."}</p>
        <label className="grid gap-2 text-sm">Authority evidence<textarea className={control} maxLength={2000} value={authority} onChange={event=>setAuthority(event.target.value)}/></label>
        <label className="grid gap-2 text-sm">Venue, location and date evidence<textarea className={control} maxLength={2000} value={location} onChange={event=>setLocation(event.target.value)}/></label>
        <label className="flex min-h-11 items-start gap-3 text-sm"><input className="mt-1 size-4" type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)}/><span>I checked this submitted revision, the publishing authority, venue coordinates and dates. I checked the submitted photos and their publishing rights, where provided.</span></label>
        <Button type="button" disabled={!item.permissionConfirmed||!checked||!authority.trim()||!location.trim()} onClick={()=>void decide("approve")}>Approve special</Button>
      </>:null}
      <label className="grid gap-2 text-sm">Correction or removal reason<textarea className={control} maxLength={2000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <div className="flex flex-wrap gap-3">{item.pending?<Button type="button" variant="outline" disabled={!reason.trim()} onClick={()=>void decide("reject")}>Request correction</Button>:null}{item.published?<Button type="button" variant="outline" disabled={!reason.trim()} onClick={()=>void decide("unpublish")}>Unpublish special</Button>:null}</div>
    </fieldset>
    {busy?<p role="status" className="text-sm">Saving decision…</p>:null}{message?<p role="status" className="text-sm">{message}</p>:null}{error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
    {blocked?<Button variant="outline" onClick={()=>window.location.reload()}>Load latest version</Button>:null}
    {next?<Link className="inline-flex min-h-11 items-center text-forest underline" href={next}>Continue account checks</Link>:null}
  </div>;
}
