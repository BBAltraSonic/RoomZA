"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Camera, MapPin } from "lucide-react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
import { BlurImage } from "@/lib/motion/primitives";
import { MOTION_SPRING } from "@/lib/motion/tokens";

export type DiscoveryCardSignal = {
  label: string;
  description: string;
  tone: "neutral" | "success" | "info" | "warning" | "response";
  icon?: ReactNode;
};
type CardPresentation = "standard" | "desktop-results" | "responsive-results";
type CardMedia = {
  imageUrls: string[];
  imageAlt: string;
  placeholder: ReactNode;
  action?: ReactNode;
  loadingTestId?: string;
  fallbackTestId?: string;
};

/** Render imagery only when the category supplies it or needs a missing-image fallback. */
function DiscoveryCardMedia({
  imageUrls, imageAlt, placeholder, action, loadingTestId, fallbackTestId, presentation, slotPrefix,
}: CardMedia & { presentation: CardPresentation; slotPrefix: string }) {
  const { setScrollElement, onScroll, onWheel, atStart, atEnd } = useHorizontalScrollAffordance<HTMLDivElement>();
  const fallback = <div data-testid={fallbackTestId} className="flex size-full items-center justify-center bg-muted text-muted-foreground">{placeholder}</div>;
  return (
    <div className={cn("relative z-0 w-full overflow-hidden", presentation === "desktop-results" ? "h-48 xl:h-52" : presentation === "responsive-results" ? "h-36 sm:h-40 lg:h-48 xl:h-52" : "h-36 sm:h-40")} data-slot={`${slotPrefix}-media`}>
      <div ref={setScrollElement} data-at-start={atStart} data-at-end={atEnd}
        className="scroll-contained absolute inset-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto sm:overflow-hidden scrollbar-hide pointer-events-auto"
        onScroll={onScroll} onWheel={onWheel}>
        {imageUrls.length ? imageUrls.map((url, index) => (
          <div key={`${url}:${index}`} className="relative h-full w-full shrink-0 snap-center">
            <BlurImage src={url} alt={`${imageAlt} - Image ${index + 1}`} fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              wrapperClassName="size-full" loadingTestId={loadingTestId}
              className="object-cover group-hover:scale-[1.02] motion-reduce:transform-none" fallback={fallback} />
          </div>
        )) : fallback}
      </div>
      {action ? <div className="pointer-events-auto absolute right-3 top-3 z-20">{action}</div> : null}
      {presentation === "desktop-results" && imageUrls.length > 1 ? (
        <span className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-background shadow-[var(--elevation-1)]">
          <Camera className="size-3.5" aria-hidden="true" />{imageUrls.length} photos
        </span>
      ) : null}
    </div>
  );
}

/** Property's visual foundation; category adapters supply their own content and actions. */
export function DiscoveryCard({
  title, location, emphasis, emphasisSuffix, features, signals = [], signalsLabel = "Listing signals",
  description, metadata, actions, media, href, prefetch, actionLabel, onSelect, selected, className,
  presentation = "responsive-results", headingLevel = 2, truncate = false, layoutId, slotPrefix = "discovery-card", category,
}: {
  title: string;
  location: string;
  emphasis?: ReactNode;
  emphasisSuffix?: ReactNode;
  features?: ReactNode;
  signals?: DiscoveryCardSignal[];
  signalsLabel?: string;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  media?: CardMedia;
  href?: string;
  prefetch?: boolean;
  actionLabel?: string;
  onSelect?: () => void;
  selected?: boolean;
  className?: string;
  presentation?: CardPresentation;
  headingLevel?: 2 | 3;
  truncate?: boolean;
  layoutId?: string;
  slotPrefix?: string;
  category: "property" | "shopping" | "tourism" | "event" | "service";
}) {
  const isDesktopResults = presentation === "desktop-results";
  const isResponsiveResults = presentation === "responsive-results";
  const Heading = headingLevel === 2 ? m.h2 : m.h3;
  const titleActionClasses = cn(
    "relative z-20 rounded-sm text-left hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    truncate ? "max-w-full truncate" : "inline-flex min-h-11 items-center break-words",
  );
  return (
    <m.article
      className={cn(
        "motion-interactive property-card-pointer-glow group relative mx-auto block w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-card text-left shadow-[var(--property-card-shadow)] transition-[border-color,box-shadow,opacity,transform] duration-[220ms] ease-[var(--ease-out-expo)] hover:border-forest/20 hover:shadow-[var(--shadow-floating)]",
        selected && "border-forest ring-2 ring-forest/25 shadow-[var(--elevation-2)]", className,
      )}
      data-slot={slotPrefix} data-card-category={category}
      onClick={(event) => {
        if (!onSelect) return;
        const target = event.target;
        if (target instanceof Element && target.closest("a, button, input, select, textarea, [role='button'], [role='link']")) return;
        onSelect();
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
      }}
      layout={Boolean(layoutId)} layoutId={layoutId} transition={MOTION_SPRING.soft}
    >
      {media ? <DiscoveryCardMedia {...media} presentation={presentation} slotPrefix={slotPrefix} /> : null}
      <div className={cn("relative bg-card", isDesktopResults ? "px-4 pb-4 pt-4" : isResponsiveResults ? "px-3.5 pb-3 pt-3 lg:px-4 lg:pb-4 lg:pt-4" : "px-3.5 pb-3 pt-3")} data-slot={`${slotPrefix}-content`}>
        {emphasis != null || features ? (
          <div className="flex min-w-0 items-center justify-between gap-3">
            {emphasis != null ? (
              <m.div data-slot={`${slotPrefix}-${category === "property" ? "price" : "emphasis"}`} layoutId={layoutId ? `${layoutId}-price` : undefined} className="flex min-w-0 items-baseline gap-1">
                <span className={cn("font-heading font-bold leading-none tracking-tight text-ink", truncate ? "truncate" : "break-words leading-tight", isDesktopResults ? "text-lg" : isResponsiveResults ? "text-base lg:text-lg" : "text-base")}>{emphasis}</span>
                {emphasisSuffix ? <span className="shrink-0 text-[11px] font-semibold leading-none text-muted-foreground">{emphasisSuffix}</span> : null}
              </m.div>
            ) : null}
            {features ? <div className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-ink" data-slot={`${slotPrefix}-features`}>{features}</div> : null}
          </div>
        ) : null}
        <Heading layoutId={layoutId ? `${layoutId}-title` : undefined}
          className={cn("font-heading font-semibold leading-tight text-ink", emphasis != null || features ? "mt-2" : "", truncate ? "truncate" : "break-words", isDesktopResults ? "text-[15px]" : isResponsiveResults ? "text-sm lg:text-[15px]" : "text-sm")}>
          {href ? <Link href={href} prefetch={prefetch} aria-label={actionLabel} className={titleActionClasses}>{title}</Link>
            : onSelect ? <button type="button" onClick={onSelect} aria-label={actionLabel} className={titleActionClasses}>{title}</button> : title}
        </Heading>
        <div className="mt-1 flex items-center gap-1.5" data-slot={`${slotPrefix}-location`}>
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <m.p layoutId={layoutId ? `${layoutId}-location` : undefined} className={cn("text-[11px] text-muted-foreground", truncate ? "truncate" : "min-w-0 break-words")}>{location}</m.p>
        </div>
        {signals.length ? (
          <ul className={cn("flex min-h-5 items-center gap-1.5", truncate ? "overflow-hidden" : "flex-wrap", isDesktopResults ? "mt-3" : isResponsiveResults ? "mt-2 lg:mt-3" : "mt-2")} aria-label={signalsLabel} data-slot={`${slotPrefix}-signals`}>
            {signals.map((signal) => (
              <li key={`${signal.label}:${signal.description}`} aria-label={`${signal.label}. ${signal.description}`} title={signal.description}
                className={cn("inline-flex min-w-0 shrink items-center gap-1 truncate rounded-full border px-2 py-1 text-[10px] font-semibold leading-none",
                  signal.tone === "success" && "border-forest/20 bg-accent text-forest",
                  signal.tone === "info" && "border-status-info-border bg-status-info-surface text-status-info-text",
                  (signal.tone === "warning" || signal.tone === "response") && "border-status-warning-border bg-status-warning-surface text-status-warning-text",
                  signal.tone === "neutral" && "border-border/70 bg-warm-surface text-muted-foreground",
                )}>{signal.icon}<span className="truncate">{signal.label}</span></li>
            ))}
          </ul>
        ) : null}
        {description ? <div className="mt-3 text-sm leading-relaxed text-ink">{description}</div> : null}
        {metadata ? <div className="mt-3 space-y-1 break-words text-xs text-muted-foreground">{metadata}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-2">{actions}</div> : null}
      </div>
    </m.article>
  );
}

export function DiscoveryCardMapAction({ onClick, selected }: { onClick: () => void; selected?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={Boolean(selected)}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-semibold text-forest underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <MapPin className="size-3.5" aria-hidden="true" />Show on map
    </button>
  );
}

