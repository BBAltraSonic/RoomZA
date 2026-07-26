"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Heart,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
import { isNewListing } from "@/features/listings/listing-freshness";
import { MOTION_SPRING } from "@/lib/motion/tokens";
import { MOTION_CELEBRATION_MS } from "@/lib/motion/tokens";
import { BlurImage, SuccessFeedback } from "@/lib/motion/primitives";
import {
  selectLandlordTrustSignals,
  type LandlordTrustSummary,
} from "@/features/trust/landlord-signals";
import type { PresenceBadge as PresenceBadgeValue } from "@/features/presence/presence-status";
import type { UpcomingLiveTour } from "@/features/live-tours/types";
import type { ListingLiveActivity } from "@/features/map-discovery/live-activity";

export type PropertyCardData = {
  id: string;
  title: string;
  area?: string | null;
  address?: string | null;
  price: number | string;
  salePrice?: number | null;
  displayPrice?: number | string | null;
  listingType?: "rent" | "sale";
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  parkingCount?: number | string | null;
  propertyType?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  imageAlt?: string;
  availabilityDate?: string | null;
  status?: string | null;
  createdAt?: string | null;
  nsfasApproved?: boolean;
  listingReviewedAt?: string | null;
  landlordTrust?: LandlordTrustSummary | null;
  landlordPresence?: PresenceBadgeValue;
  liveTourId?: string | null;
  upcomingLiveTour?: UpcomingLiveTour | null;
  hasInstantViewing?: boolean;
  liveActivity?: ListingLiveActivity | null;
  actionLabel?: string;
  agent?: {
    id?: string;
    name: string;
    avatarUrl?: string;
    phone?: string;
    isVerified?: boolean;
    agency?: string;
  } | null;
};

import { formatPrice } from "@/lib/utils";

// Rentals quote a monthly rate; sale listings quote a once-off price. Derive the
// suffix from the listing status so a "For sale" card never reads ".../month".
function priceSuffix(property: PropertyCardData) {
  if (property.listingType === "sale" || (property.status && /sale|buy|sold/i.test(property.status))) return null;
  return "/month";
}

function availabilityLabel(date?: string | null) {
  if (!date) return "Available";
  const availableDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (availableDate <= today) return "Available now";

  return `From ${availableDate.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  })}`;
}

type CardSignal = {
  label: string;
  description: string;
  tone: "neutral" | "success" | "info" | "warning" | "response";
  icon?: "nsfas" | "reviewed";
};

function cardSignals(property: PropertyCardData, isNew: boolean, isSale: boolean): CardSignal[] {
  const trustSignal = selectLandlordTrustSignals(property.landlordTrust)[0];
  const primary: CardSignal = property.liveTourId
    ? { label: "Live tour", description: "A live video tour is happening now.", tone: "info" }
    : property.hasInstantViewing
      ? { label: "Viewing now", description: "An instant viewing is in progress.", tone: "warning" }
      : property.landlordPresence === "available"
        ? { label: "Available now", description: "The landlord is currently available.", tone: "success" }
        : isSale
          ? { label: "For sale", description: "This property is listed for sale.", tone: "neutral" }
          : {
              label: availabilityLabel(property.availabilityDate),
              description: "The advertised availability for this home.",
              tone: "neutral",
            };

  const verification: CardSignal | null = property.nsfasApproved
    ? {
        label: "NSFAS",
        description: "Accredited student accommodation.",
        tone: "success",
        icon: "nsfas",
      }
    : property.listingReviewedAt
      ? {
          label: "Reviewed",
          description: `Listing reviewed by Pinpoint on ${new Date(property.listingReviewedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}. This does not verify identity or property ownership.`,
          tone: "success",
          icon: "reviewed",
        }
      : null;

  const supporting: CardSignal | null = trustSignal
    ? {
        label: trustSignal.compactLabel,
        description: trustSignal.description,
        tone: trustSignal.tone === "verified" ? "success" : "response",
      }
    : isNew
      ? { label: "New", description: "Added within the last seven days.", tone: "neutral" }
      : null;

  return [primary, verification, supporting].filter((signal): signal is CardSignal => signal !== null).slice(0, 3);
}

export function PropertyCard({
  property,
  href,
  selected,
  onSelect,
  action,
  className,
}: {
  property: PropertyCardData;
  href?: string;
  selected?: boolean;
  onSelect?: () => void;
  action?: React.ReactNode;
  className?: string;
}) {
  const classes = cn(
    "motion-interactive property-card-pointer-glow group relative mx-auto block w-full overflow-hidden rounded-xl border border-border/60 bg-card text-left shadow-[var(--property-card-shadow)] transition-[border-color,box-shadow,opacity,transform] duration-[220ms] ease-[var(--ease-out-expo)] hover:border-border hover:shadow-[var(--elevation-2)]",
    selected ? "border-forest ring-2 ring-forest/25 shadow-[var(--elevation-2)]" : "",
    className
  );

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const {
    setScrollElement: setImageScrollElement,
    onScroll: handleImageAffordanceScroll,
    onWheel: handleImageAffordanceWheel,
    atStart: imageAtStart,
    atEnd: imageAtEnd,
  } = useHorizontalScrollAffordance<HTMLDivElement>();
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPosition = target.scrollLeft;
    const width = target.clientWidth;
    const index = Math.round(scrollPosition / width);
    if (index !== activeImageIndex) setActiveImageIndex(index);
    handleImageAffordanceScroll(e);
  };

  const isNew = isNewListing(property.createdAt);
  const isSale = property.listingType === "sale";
  const displayPrice = property.displayPrice ?? (isSale ? property.salePrice ?? property.price : property.price);
  const signals = cardSignals(property, isNew, isSale);

  const handlePointerGlow = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!onSelect) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("a, button, input, select, textarea, [role='button'], [role='link']")
    ) {
      return;
    }

    onSelect();
  };

  return (
    <m.article
      className={classes}
      data-slot="property-card"
      onClick={handleCardClick}
      onPointerMove={handlePointerGlow}
      layout
      layoutId={`listing-${property.id}`}
      transition={MOTION_SPRING.soft}
    >
      {/* Top Image Section */}
      <div className="relative z-0 h-36 w-full overflow-hidden rounded-t-xl sm:h-40" data-slot="property-card-media">
        <div 
          ref={setImageScrollElement}
          data-at-start={imageAtStart}
          data-at-end={imageAtEnd}
          className="scroll-contained absolute inset-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto sm:overflow-hidden scrollbar-hide pointer-events-auto"
          onScroll={handleScroll}
          onWheel={handleImageAffordanceWheel}
        >
          {(property.imageUrls?.length ? property.imageUrls : [property.imageUrl]).filter(Boolean).map((url, i) => (
            <div key={i} className="relative h-full w-full shrink-0 snap-center">
              <BlurImage
                src={url as string}
                alt={`${property.imageAlt ?? property.title} - Image ${i + 1}`}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                wrapperClassName="size-full"
                loadingTestId="listing-image-loading"
                className="object-cover group-hover:scale-[1.02] motion-reduce:transform-none"
                fallback={(
                  <div
                  data-testid="listing-image-placeholder"
                  className="flex size-full items-center justify-center bg-muted text-muted-foreground"
                >
                  <Building2 className="size-10" />
                  </div>
                )}
              />
            </div>
          ))}
          {!(property.imageUrls?.length || property.imageUrl) && (
            <div className="relative h-full w-full shrink-0 snap-center bg-muted">
              <div
                data-testid="listing-image-placeholder"
                className="absolute inset-0 flex items-center justify-center text-muted-foreground"
              >
                <Building2 className="size-10" />
              </div>
            </div>
          )}
        </div>
        
        {/* Top Left Photo Count Badge — camera icon + photo count */}
        {/* Top Right Action Column — stacked circular floating buttons (close + heart) */}
        {action ? <div className="pointer-events-auto absolute right-3 top-3 z-20">{action}</div> : null}

        {/* Scroll Nav Buttons (Desktop) */}
      </div>

      <div className="relative bg-card px-3.5 pb-3 pt-3" data-slot="property-card-content">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <m.div
            data-slot="property-card-price"
            layoutId={`listing-${property.id}-price`}
            className="flex min-w-0 items-baseline gap-1"
          >
            <span className="truncate font-heading text-base font-bold leading-none tracking-tight text-ink">{formatPrice(displayPrice)}</span>
            {priceSuffix(property) ? (
              <span className="shrink-0 text-[11px] font-semibold leading-none text-muted-foreground">{priceSuffix(property)}</span>
            ) : null}
          </m.div>
          <div className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-ink" data-slot="property-card-features">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {property.bedrooms ?? "-"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bath className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {property.bathrooms ?? "-"}
            </span>
          </div>
        </div>

        {/* Title */}
        <m.h3 layoutId={`listing-${property.id}-title`} className="mt-2 truncate font-heading text-sm font-semibold leading-tight text-ink">
          {href ? (
            <Link href={href} aria-label={`View details for ${property.title}`} className="relative z-20 rounded-sm hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {property.title}
            </Link>
          ) : onSelect ? (
            <button type="button" onClick={onSelect} aria-label={`View details for ${property.title}`} className="relative z-20 max-w-full truncate rounded-sm text-left hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {property.title}
            </button>
          ) : property.title}
        </m.h3>

        <div className="mt-1 flex items-center gap-1.5" data-slot="property-card-location">
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <m.p layoutId={`listing-${property.id}-location`} className="truncate text-[11px] text-muted-foreground">
            {property.address ?? property.area ?? "Location to confirm"}
          </m.p>
        </div>

        <ul className="mt-2 flex min-h-5 items-center gap-1.5 overflow-hidden" aria-label="Listing signals" data-slot="property-card-signals">
          {signals.map((signal) => (
            <li
              key={`${signal.label}:${signal.description}`}
              aria-label={`${signal.label}. ${signal.description}`}
              title={signal.description}
              className={cn(
                "inline-flex min-w-0 shrink items-center gap-1 truncate rounded-full border px-2 py-1 text-[10px] font-semibold leading-none",
                signal.tone === "success" && "border-forest/20 bg-accent text-forest",
                signal.tone === "info" && "border-status-info-border bg-status-info-surface text-status-info-text",
                signal.tone === "warning" && "border-status-warning-border bg-status-warning-surface text-status-warning-text",
                signal.tone === "response" && "border-status-warning-border bg-status-warning-surface text-status-warning-text",
                signal.tone === "neutral" && "border-border/70 bg-warm-surface text-muted-foreground",
              )}
            >
              {signal.icon === "nsfas" ? <ShieldCheck className="size-3 shrink-0" aria-hidden="true" /> : null}
              {signal.icon === "reviewed" ? <BadgeCheck className="size-3 shrink-0" aria-hidden="true" /> : null}
              <span className="truncate">{signal.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </m.article>
  );
}

export function SaveIconButton({
  saved,
  onClick,
}: {
  saved?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  // Play a one-time "pop" only when transitioning into the saved state, so the
  // save lands with tactile feedback while un-saving stays quiet.
  const [popping, setPopping] = useState(false);
  const [celebrationSequence, setCelebrationSequence] = useState(0);
  const prevSaved = useRef(saved);

  useEffect(() => {
    if (saved && !prevSaved.current) {
      setCelebrationSequence((sequence) => sequence + 1);
      setPopping(true);
      const timer = setTimeout(() => setPopping(false), MOTION_CELEBRATION_MS);
      prevSaved.current = saved;
      return () => clearTimeout(timer);
    }
    prevSaved.current = saved;
  }, [saved]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex size-11 items-center justify-center overflow-visible rounded-full border bg-panel/90 text-ink shadow-[var(--elevation-1)] backdrop-blur-sm transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
        saved && "border-forest bg-forest text-primary-foreground hover:text-primary-foreground",
      )}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      data-saved={saved ? "true" : "false"}
      data-save-motion={popping ? "active" : "idle"}
    >
      {popping ? (
        <SuccessFeedback
          compact
          eventKey={`property-saved-${celebrationSequence}`}
          title="Property saved"
          className="pointer-events-none"
          icon={<Heart className="size-[1.125rem] fill-current sm:size-4" aria-hidden="true" />}
        />
      ) : <Heart className={cn("size-[1.125rem] sm:size-4", saved && "fill-current")} />}
    </button>
  );
}

export function PropertyFact({
  icon: Icon = CalendarDays,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-warm-surface px-3 py-2.5">
      <Icon className="size-4 text-forest" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
