import Link from "next/link";
import { readEntryReviewQueue } from "@/features/entries/publication-data";
import { EntryReviewEditor } from "@/features/entries/entry-review-editor";
import { formatEntryTimeSast } from "@/features/entries/schema";
export const dynamic="force-dynamic";
export default async function EntryReviewPage(){
  const items=await readEntryReviewQueue();
  return <div className="space-y-7"><header className="space-y-2"><h1 className="text-2xl font-semibold">Tourism and Event Specials</h1><p className="text-sm text-muted-foreground">Review submitted content and publishing permission before making a special public.</p></header>
    {items.length===0?<p>No pending or approved entry specials.</p>:items.map(item=><section key={`${item.entryId}:${item.version}`} className="space-y-5 rounded-2xl border border-border bg-panel p-5">
      <header><p className="text-sm text-muted-foreground">{item.category==="event"?"Event":"Tourism"} · {item.pending?"Awaiting review":"Approved revision"}</p><h2 className="break-words text-xl font-semibold">{item.content.title}</h2></header>
      <p className="whitespace-pre-wrap break-words text-sm">{item.content.description}</p><p className="break-words text-sm">{item.content.venueName} · {item.content.address}</p>
      <p className="text-sm">{formatEntryTimeSast(item.content.startsAt)} – {formatEntryTimeSast(item.content.endsAt)}</p>
      <p className="break-all text-xs text-muted-foreground">Submitted revision {item.revisionId} · Submitted {formatEntryTimeSast(item.submittedAt)}</p>
      <p className="break-all text-sm text-muted-foreground">Venue point: {item.content.latitude}, {item.content.longitude} · Discovery area: {item.content.areaId}</p>
      <a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(`${item.content.latitude},${item.content.longitude}`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-forest underline">Check venue location</a>
      <EntryReviewEditor item={item}/>
    </section>)}<Link href="/offers" className="inline-flex min-h-11 items-center text-forest underline">Public Specials</Link>
  </div>;
}
