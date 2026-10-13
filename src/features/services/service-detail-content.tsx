"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/lib/motion/primitives";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import { servicePublicContact } from "@/features/guest-contact/schema";
import { useServiceDetail } from "./use-service-detail";
import type { PublicService } from "./schema";

type Props = { id: string; onClose: () => void };
export function ServiceDetailContent(props: Props) {
  return <ServiceDetailBody key={props.id} {...props} />;
}

function ServiceDetailBody({ id, onClose }: Props) {
  const { status, item, retry } = useServiceDetail(id);
  return <section data-slot="service-detail-content" aria-label="Service details" className="flex h-full min-h-0 flex-col bg-panel text-ink">
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
      <Button variant="ghost" aria-label="Back to services" onClick={onClose} className="min-h-11 min-w-11"><ArrowLeft size={18} aria-hidden="true" />Back</Button>
      <span className="text-sm font-semibold">Service details</span>
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {status === "loading" ? <p role="status">Loading service details...</p> : status === "error" ? <div className="space-y-3">
        <p role="alert" className="text-status-error-text">Service details could not be loaded. Try again.</p>
        <Button variant="outline" onClick={retry}>Retry service details</Button>
      </div> : !item ? <p role="status">This service is no longer available.</p> : <>
        <ServicePhotos media={item.media} title={item.content.title} />
        <header className="space-y-2">
          <p className="text-sm font-semibold text-forest">{item.content.serviceType}</p>
          <h1 className="break-words text-2xl font-semibold">{item.content.title}</h1>
          <p className="break-words font-medium">{item.content.providerName}</p>
          <p className="break-words text-sm text-muted-foreground">{item.content.address}</p>
        </header>
        <div className="border-y border-border py-2"><ContactActions contact={servicePublicContact(item.content)} title={item.content.title} /></div>
        <section aria-label="About this service" className="space-y-2">
          <h2 className="text-base font-semibold">About this service</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.content.description}</p>
        </section>
      </>}
    </div>
  </section>;
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
