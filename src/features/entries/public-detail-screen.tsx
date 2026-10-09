"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { observeDiscoveryRefresh } from "@/features/discovery/refresh";
import { formatEntryTimeSast } from "./schema";
import { entryFeedHref } from "./public-url";
import { entryDirectionsSchema, publicEntryDetailSchema } from "./public-contract";
import type { z } from "zod";

export function PublicEntryDetailScreen(props: Parameters<typeof PublicEntryDetailScreenContent>[0]) {
  return <PublicEntryDetailScreenContent key={props.entryId} {...props} />;
}

function PublicEntryDetailScreenContent({entryId}:{entryId:string}) {
  const [detail,setDetail]=useState<z.infer<typeof publicEntryDetailSchema>|null>(null),[checking,setChecking]=useState(true),[error,setError]=useState(""),[acting,setActing]=useState(false),[retry,setRetry]=useState(0);
  const deadline=useRef(0),action=useRef<AbortController|null>(null),item=detail?.item;
  useEffect(()=>{let disposed=false,sequence=0;let request:AbortController|undefined,alarm:ReturnType<typeof setTimeout>|undefined;
    async function refresh(){request?.abort();action.current?.abort();const controller=new AbortController();request=controller;const current=++sequence,started=performance.now();setChecking(true);
      try{const response=await fetch(`/api/entries/${entryId}`,{cache:"no-store",signal:controller.signal});if(![200,404].includes(response.status))throw new Error();const fresh=publicEntryDetailSchema.parse(await response.json());if(fresh.item&&fresh.item.entryId!==entryId)throw new Error();if(disposed||controller.signal.aborted||current!==sequence)return;
        clearTimeout(alarm);deadline.current=fresh.item?started+Date.parse(fresh.item.content.endsAt)-Date.parse(fresh.serverNow):0;
        if(fresh.item&&deadline.current<=performance.now())fresh.item=null;
        setDetail(fresh);setChecking(false);setError("");
        if(fresh.item){const boundary=fresh.item.state==="upcoming"?Math.min(deadline.current,started+Date.parse(fresh.item.content.startsAt)-Date.parse(fresh.serverNow)):deadline.current;
          alarm=setTimeout(()=>{if(performance.now()>=deadline.current)setDetail(null);void refresh();},Math.min(Math.max(0,boundary-performance.now()),2_147_483_647));}
      }catch{if(!disposed&&!controller.signal.aborted&&current===sequence){deadline.current=0;setDetail(null);setChecking(false);setError("Could not check this special. Try again before travelling.");}}
    }
    void refresh();const stop=observeDiscoveryRefresh(refresh);return()=>{disposed=true;request?.abort();action.current?.abort();clearTimeout(alarm);stop();};
  },[entryId,retry]);
  async function directions(){if(!item||checking||acting)return;if(performance.now()>=deadline.current){setDetail(null);setRetry(value=>value+1);return;}const controller=new AbortController();action.current?.abort();action.current=controller;setActing(true);const started=performance.now();
    try{const response=await fetch(`/api/entries/${entryId}/directions`,{cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error();const value=entryDirectionsSchema.parse(await response.json());if(controller.signal.aborted)return;if(Date.parse(value.endsAt)-Date.parse(value.serverNow)<=performance.now()-started||performance.now()>=deadline.current)throw new Error();window.location.assign(value.url);
    }catch{if(!controller.signal.aborted){setError("Directions are unavailable. Check this special again.");setDetail(null);setRetry(value=>value+1);}}finally{if(action.current===controller)setActing(false);}}
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-8"><Link className="inline-flex min-h-11 items-center text-forest underline" href={item?entryFeedHref(item.category,item.content.areaId,"feed"):"/offers"}>Browse Specials</Link><h1 className="break-words text-3xl font-semibold">{item?.content.title??(error?"Could not check this special":checking?"Checking special…":"This special is unavailable")}</h1>
    <p role="status" className="text-sm">{checking?"Checking current availability…":item?.state==="upcoming"?"Upcoming":item?"Available now":"It may have ended, been withdrawn or be awaiting approval. Directions are unavailable."}</p>
    {item?<><p className="whitespace-pre-wrap break-words">{item.content.description}</p><section className="space-y-3 border-y border-border py-5"><h2 className="break-words text-xl font-semibold">{item.content.venueName}</h2><p className="break-words">{item.content.address}</p><p>{formatEntryTimeSast(item.content.startsAt)} – {formatEntryTimeSast(item.content.endsAt)}</p><Button disabled={checking||acting} onClick={()=>void directions()}>{acting?"Checking directions…":"Get venue directions"}</Button><p className="text-xs text-muted-foreground">Opens Google Maps for the approved venue. Check the dates before travelling.</p></section></>:null}
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}<Button variant="outline" disabled={checking} onClick={()=>setRetry(value=>value+1)}>Check again</Button>
  </main>;
}
