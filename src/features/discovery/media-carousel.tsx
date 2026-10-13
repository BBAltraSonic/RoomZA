"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BlurImage } from "@/lib/motion/primitives";
import { PhotoPlaceholder } from "./photo-placeholder";

type Media = { id: string; url: string };

export function MediaCarousel({ media = [], title }: { media?: Media[]; title: string }) {
  // Signing refreshes keep the current slide; a different gallery starts at its cover.
  return <MediaCarouselBody key={media.map(photo => photo.id).join(":")} media={media} title={title} />;
}

function MediaCarouselBody({ media, title }: { media: Media[]; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const multiple = media.length > 1;
  function goTo(next: number) {
    const bounded = Math.max(0, Math.min(media.length - 1, next));
    setIndex(bounded);
    // Native scroll snapping supplies touch swiping without intercepting vertical scrolling.
    track.current?.scrollTo({ left: bounded * track.current.clientWidth, behavior: "instant" });
  }
  return <section aria-label={title + " photos"} aria-roledescription="carousel" className="space-y-2" data-slot="special-media-carousel">
    <div ref={track} tabIndex={multiple ? 0 : undefined} aria-label="Photos, use left and right arrow keys to browse"
      className="flex aspect-[4/3] max-h-[min(60dvh,28rem)] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onScroll={event => {
        const element = event.currentTarget;
        if (element.clientWidth) setIndex(Math.max(0, Math.min(media.length - 1, Math.round(element.scrollLeft / element.clientWidth))));
      }}
      onKeyDown={event => {
        if (!multiple || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        goTo(event.key === "Home" ? 0 : event.key === "End" ? media.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1));
      }}>
      {media.length ? media.map((photo, position) => <div key={photo.id} role="group" aria-roledescription="slide" aria-label={(position + 1) + " of " + media.length} aria-hidden={position !== index} className="relative h-full w-full shrink-0 snap-start snap-always">
        <BlurImage src={photo.url} alt={title + ", photo " + (position + 1)} fill sizes="(min-width: 1024px) 480px, (min-width: 768px) 720px, 100vw" wrapperClassName="size-full" className="object-contain motion-reduce:transform-none motion-reduce:transition-none" fallback={<PhotoPlaceholder />} />
      </div>) : <PhotoPlaceholder />}
    </div>
    {multiple ? <div className="flex items-center justify-between gap-3">
      <button type="button" aria-label="Previous photo" disabled={index === 0} onClick={() => goTo(index - 1)} className="flex size-11 items-center justify-center rounded-full border border-border text-ink outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><ChevronLeft size={20} aria-hidden="true" /></button>
      <p aria-live="polite" aria-atomic="true" className="text-sm tabular-nums text-muted-foreground">{index + 1} / {media.length}</p>
      <button type="button" aria-label="Next photo" disabled={index === media.length - 1} onClick={() => goTo(index + 1)} className="flex size-11 items-center justify-center rounded-full border border-border text-ink outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><ChevronRight size={20} aria-hidden="true" /></button>
    </div> : null}
  </section>;
}
