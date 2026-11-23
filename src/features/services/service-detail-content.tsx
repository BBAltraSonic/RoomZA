"use client";

import { useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, MapPin, Share2, UserRound, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/lib/motion/primitives";
import { DirectContactSheet, QuoteRequestButton } from "@/features/guest-contact/direct-contact-sheet";
import { servicePublicContact } from "@/features/guest-contact/schema";
import { isNewListing } from "@/features/listings/listing-freshness";
import { useServiceDetail } from "./use-service-detail";
import { servicePriceParts, ServiceTypeIcon } from "./service-feed-card";
import type { PublicService } from "./schema";

type Props = { id: string; onClose: () => void };
export function ServiceDetailContent(props: Props) {
  return <ServiceDetailBody key={props.id} {...props} />;
}

function ServiceDetailBody({ id, onClose }: Props) {
  const { status, item, retry } = useServiceDetail(id);
  const [shareMessage, setShareMessage] = useState("");
  const contact = item ? servicePublicContact(item.content) : null;
  async function share() {
    if (!item) return;
    const url = new URL(window.location.href);
    url.searchParams.set("detailId", item.id);
    if (navigator.share) { try { await navigator.share({ title: item.content.title, url: url.href }); return; } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url.href); setShareMessage("Link copied"); } catch { setShareMessage("Sharing unavailable. Copy the link from the address bar."); }
  }
  return <section data-slot="service-detail-content" aria-label="Service details" className="flex h-full min-h-0 flex-col bg-panel text-ink">
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
      <Button variant="ghost" aria-label="Back to services" onClick={onClose} className="min-h-11 min-w-11"><ArrowLeft size={18} aria-hidden="true" />Back</Button>
      <span className="min-w-0 flex-1 text-sm font-semibold">Service details</span>
      {item ? <Button variant="ghost" aria-label="Share service" onClick={() => void share()} className="min-h-11 min-w-11"><Share2 size={18} aria-hidden="true" /></Button> : null}
    </div>
    {shareMessage ? <p role="status" className="px-4 pt-2 text-xs text-muted-foreground">{shareMessage}</p> : null}
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {status === "loading" ? <p role="status">Loading service details...</p> : status === "error" ? <div className="space-y-3">
        <p role="alert" className="text-status-error-text">Service details could not be loaded. Try again.</p>
        <Button variant="outline" onClick={retry}>Retry service details</Button>
      </div> : !item ? <p role="status">This service is no longer available.</p> : <>
        <ServicePhotos media={item.media} title={item.content.title} />
        <ServiceSummary item={item} />
        <section aria-label="About this service" className="space-y-2">
          <h2 className="text-base font-semibold">About this service</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.content.description}</p>
        </section>
      </>}
    </div>
    {item ? <footer className="shrink-0 border-t border-border bg-panel px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* As on a home: Contact beside the one primary step, which for a service is asking for a price. */}
      <div role="group" aria-label="Service actions" className="grid grid-cols-2 gap-2">
        <DirectContactSheet contact={contact} title={item.content.title} name={item.content.providerName} className={contact ? undefined : "col-span-2"} />
        <QuoteRequestButton contact={contact} title={item.content.title} />
      </div>
    </footer> : null}
  </section>;
}

function ServiceSummary({ item }: { item: PublicService }) {
  const price = servicePriceParts(item.content);
  const reviewedOn = new Date(item.approved_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  return <header className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-forest"><ServiceTypeIcon type={item.content.serviceType} />{item.content.serviceType}</span>
      {isNewListing(item.approved_at) ? <span className="rounded-full border border-border/70 bg-warm-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground">New</span> : null}
    </div>
    <h1 className="break-words font-heading text-2xl font-semibold leading-tight">{item.content.title}</h1>
    <p className="flex items-baseline gap-1.5" data-slot="service-detail-price">
      <span className="font-heading text-2xl font-bold tracking-tight">{price.emphasis}</span>
      {price.suffix ? <span className="text-sm font-semibold text-muted-foreground">{price.suffix}</span> : null}
    </p>
    <dl className="grid gap-2 rounded-xl border border-border bg-warm-surface p-3 text-sm">
      <div className="flex items-center gap-2"><dt><UserRound className="size-4 text-forest" aria-hidden="true" /><span className="sr-only">Provider</span></dt><dd className="min-w-0 break-words font-semibold">{item.content.providerName}</dd></div>
      <div className="flex items-center gap-2"><dt><MapPin className="size-4 text-forest" aria-hidden="true" /><span className="sr-only">Based in</span></dt><dd className="min-w-0 break-words text-muted-foreground">{item.content.address}</dd></div>
      <div className="flex items-start gap-2"><dt><BadgeCheck className="mt-0.5 size-4 text-forest" aria-hidden="true" /><span className="sr-only">Review</span></dt><dd className="min-w-0 text-muted-foreground">Reviewed by Pinpoint on {reviewedOn}. This does not verify identity or qualifications.</dd></div>
    </dl>
  </header>;
}

function ServicePhotos({ media, title }: { media: PublicService["media"]; title: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = media?.length ?? 0;
  const placeholder = <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"><Wrench className="size-10" aria-hidden="true" /><span className="text-sm">{count ? "Photo unavailable" : "Photos not provided"}</span></div>;
  function go(next: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ left: node.clientWidth * next, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div role="region" aria-label="Service photos" className="space-y-2">
    <div ref={scroller} onScroll={event => {
      const node = event.currentTarget;
      if (node.clientWidth) setIndex(Math.max(0, Math.min(count - 1, Math.round(node.scrollLeft / node.clientWidth))));
    }} className="flex h-56 w-full snap-x snap-mandatory overflow-x-auto rounded-2xl bg-muted scrollbar-hide sm:h-64">
      {count ? media!.map((image, position) => <div key={image.id} className="relative h-full w-full shrink-0 snap-center">
        <BlurImage src={image.url} alt={`${title} - Image ${position + 1}`} fill sizes="(min-width: 1024px) 440px, 100vw" wrapperClassName="size-full" className="object-cover" fallback={placeholder} />
      </div>) : <div className="size-full shrink-0">{placeholder}</div>}
    </div>
    {count > 1 ? <div className="flex items-center justify-between gap-3">
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Previous service photo" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft aria-hidden="true" /></Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">Photo {index + 1} of {count}</p>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Next service photo" disabled={index === count - 1} onClick={() => go(index + 1)}><ChevronRight aria-hidden="true" /></Button>
    </div> : null}
  </div>;
}
