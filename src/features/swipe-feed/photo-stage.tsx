"use client";

import Image from "next/image";
import { useState } from "react";

import { PhotoPlaceholder } from "@/features/discovery/photo-placeholder";
import { cn } from "@/lib/utils";

export const FEED_IMAGE_SIZES = "(min-width: 1024px) 440px, 100vw";

/**
 * The photo on screen and progress ticks. Stepping is driven by taps the parent's
 * swipe gesture reports, so the photo and the swipe never fight over the pointer.
 */
export function PhotoStage({ imageUrls, title, index, eager }: { imageUrls: readonly string[]; title: string; index: number; eager: boolean }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const urls = imageUrls.filter((url) => url.trim() !== "");
  if (urls.length === 0) return <PhotoPlaceholder />;
  const current = Math.min(index, urls.length - 1);
  const next = urls[current + 1];

  return (
    <>
      {failed.has(urls[current]!) ? <PhotoPlaceholder /> : <Image
        key={urls[current]}
        src={urls[current]!}
        alt={urls.length > 1 ? `${title}, photo ${current + 1} of ${urls.length}` : title}
        fill
        sizes={FEED_IMAGE_SIZES}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        onError={() => setFailed((value) => new Set(value).add(urls[current]!))}
        className="pointer-events-none select-none object-cover"
      />}
      {/* The next photo loads behind the current one, so a tap shows it at once. */}
      {next ? <Image src={next} alt="" aria-hidden="true" fill sizes={FEED_IMAGE_SIZES} loading="lazy" className="invisible" /> : null}
      {urls.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex gap-1" aria-hidden="true" data-slot="photo-ticks">
          {urls.map((url, tick) => (
            <span key={url} className={cn("h-1 flex-1 rounded-full", tick === current ? "bg-media-foreground" : "bg-media-foreground/35")} />
          ))}
        </div>
      ) : null}
    </>
  );
}
