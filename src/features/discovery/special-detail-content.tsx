"use client";
import { useState } from "react";
import { Heart, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import { ReportPanel } from "@/features/admin/components/report-panel";
import { formatEntryTimeSast } from "@/features/entries/schema";
import { PublishedMedia } from "./published-media";
import { useSavedSpecial } from "./saved-specials-client";
import { useSpecialDetail } from "./use-special-detail";
import type { SpecialDetailState, SpecialDetailTarget } from "./special-detail-data";
import { cn } from "@/lib/utils";

type Props = { target: SpecialDetailTarget; initial?: SpecialDetailState; onClose?: () => void; contained?: boolean };
export function SpecialDetailContent(props: Props) {
  return <SpecialDetailContentBody key={props.target.category + props.target.id} {...props} />;
}
function SpecialDetailContentBody({ target, initial, onClose, contained }: Props) {
  const controller = useSpecialDetail(target, initial), { detail, checking, acting, error, directions } = controller, item = detail?.item;
  const save = useSavedSpecial({ id: target.id, category: item?.category ?? (target.category === "entry" ? "event" : target.category) }, item?.savedCount ?? 0);
  const [shareMessage, setShareMessage] = useState("");
  const label = (item?.category ?? target.category) === "shopping" ? "Shopping" : (item?.category ?? target.category) === "tourism" ? "Places" : "Events";
  const title = item?.title ?? (error ? "Could not check this special" : !detail ? "Checking special…" : detail.status === "expired" ? target.category === "shopping" ? "This offer has ended" : "This special has ended" : detail.status === "scheduled" ? "This offer has not started" : target.category === "shopping" ? "This offer is unavailable" : "This special is unavailable");
  const disabled = checking || acting;
  async function share() {
    if (!item) return;
    const url = new URL(item.href, window.location.origin).href;
    if (navigator.share) { try { await navigator.share({ title: item.title, url }); return; } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); setShareMessage("Link copied"); } catch { setShareMessage("Sharing unavailable. Copy the details page link."); }
  }
  const external = (name: string, url: string, primary: boolean) => disabled ? <span aria-disabled="true" className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm text-muted-foreground">{name}</span>
    : <a href={url} target="_blank" rel="noopener noreferrer" title={name + " (opens in a new tab)"} className={cn("flex min-h-11 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring", primary ? "bg-forest text-primary-foreground" : "text-forest")}>{name}</a>;
  return <section data-slot="special-detail-content" data-detail-category={item?.category ?? target.category} aria-label={label + " details"} className={cn("flex min-h-0 flex-col bg-panel text-ink", contained && "h-full")}>
    {onClose ? <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2"><span className="text-sm font-semibold">{label} details</span><Button autoFocus variant="ghost" aria-label="Close Special details" onClick={onClose} className="min-h-11 min-w-11"><X size={18} aria-hidden="true" />Close</Button></div> : null}
    <div className={cn("space-y-5 p-5", contained && "min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
      <header className="space-y-2"><p className="text-sm font-medium text-muted-foreground">{label}</p><h1 tabIndex={-1} className="break-words text-2xl font-semibold">{title}</h1>
        <p role="status" className="text-sm text-muted-foreground">{checking ? "Checking current availability…" : item ? detail?.status === "upcoming" ? "Upcoming" : "Available now" : detail?.status === "scheduled" && detail.startsAt ? "Starts " + formatEntryTimeSast(detail.startsAt) : detail?.status === "expired" && detail.endsAt ? "Ended " + formatEntryTimeSast(detail.endsAt) : error ? "Availability could not be checked." : "It may have ended, been withdrawn or be awaiting approval."}</p>
      </header>
      {item ? <>
        <PublishedMedia media={item.media} title={item.title} priceCents={item.priceCents} originalPriceCents={item.originalPriceCents} />
        <section className="space-y-2"><h2 className="text-lg font-semibold">{label === "Shopping" ? "Offer details" : label === "Events" ? "About this event" : "About this experience"}</h2><p className="whitespace-pre-wrap break-words leading-relaxed">{item.description}</p></section>
        <section className="space-y-3 border-y border-border py-4"><h2 className="break-words text-lg font-semibold">{item.identity}</h2><p className="break-words">{item.address}</p>
          <dl className="grid gap-2 text-sm"><div><dt className="text-muted-foreground">{item.category === "shopping" ? "Starts" : "From"}</dt><dd><time dateTime={item.startsAt}>{formatEntryTimeSast(item.startsAt)}</time></dd></div><div><dt className="text-muted-foreground">{item.category === "shopping" ? "Ends" : "Until"}</dt><dd><time dateTime={item.endsAt}>{formatEntryTimeSast(item.endsAt)}</time></dd></div></dl>
        </section>
        {item.terms ? <section className="space-y-2"><h2 className="text-lg font-semibold">Offer terms</h2><p className="whitespace-pre-wrap break-words leading-relaxed">{item.terms}</p></section> : null}
        <ContactActions contact={item.contact} title={item.title} disabled={disabled} />
        {item.category === "shopping" ? <><ReportPanel shoppingOfferId={item.id} label="Report this offer" /><p className="text-xs text-muted-foreground">Confirmed {formatEntryTimeSast(item.confirmedAt!)}</p>{item.poster ? <p className="break-words text-sm text-muted-foreground">Posted by {item.poster.displayName} (@{item.poster.username})</p> : null}</> : null}
      </> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button variant="outline" disabled={checking} onClick={controller.refresh}>Check again</Button>
    </div>
    {item ? <footer className="shrink-0 space-y-2 border-t border-border bg-panel px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div role="group" aria-label="Special actions" className="flex items-center gap-2">
        {item.bookingUrl ? external("Book", item.bookingUrl, true) : null}
        {item.visitUrl ? external("Visit", item.visitUrl, !item.bookingUrl) : null}
        <Button disabled={disabled} variant={item.bookingUrl || item.visitUrl ? "outline" : "default"} onClick={() => void directions()} className="min-h-11 min-w-0 flex-1 rounded-full px-3">{acting ? "Checking…" : contained ? "Directions" : item.category === "shopping" ? "Get directions" : "Get venue directions"}</Button>
      </div>
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{save.count} {save.count === 1 ? "person" : "people"} saved this</span><div className="flex gap-1"><Button variant="ghost" className="min-h-11 min-w-11" aria-label={save.saved ? "Remove Special from saved" : "Save Special"} aria-pressed={save.saved} disabled={disabled || save.pending} onClick={() => void save.toggle()}><Heart size={18} className={save.saved ? "fill-current" : ""} aria-hidden="true" /></Button><Button variant="ghost" className="min-h-11 min-w-11" aria-label="Share Special" disabled={disabled} onClick={() => void share()}><Share2 size={18} aria-hidden="true" /></Button></div></div>
      {shareMessage ? <p aria-live="polite" className="text-xs">{shareMessage}</p> : null}
    </footer> : null}
  </section>;
}
