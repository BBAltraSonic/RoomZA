"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Building2, CalendarDays, Heart, MapPin, ChevronRight, ChevronLeft, Camera, BadgeCheck, ShieldCheck, X } from "lucide-react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
import { ListingVideoCallButton } from "@/features/chat/listing-video-call-button";
import { calculateMonthlyBond } from "@/features/purchase/bond-calculator";
import { isNewListing } from "@/features/listings/listing-freshness";
import { MOTION_SPRING } from "@/lib/motion/tokens";
import { MOTION_CELEBRATION_MS } from "@/lib/motion/tokens";
import { BlurImage, SuccessFeedback } from "@/lib/motion/primitives";

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

export function PropertyCard({
  property,
  href,
  selected,
  onSelect,
  onClose,
  action,
  showVideoCall = true,
  compact = false,
  className,
}: {
  property: PropertyCardData;
  href?: string;
  selected?: boolean;
  onSelect?: () => void;
  onClose?: () => void;
  action?: React.ReactNode;
  showVideoCall?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const classes = cn(
    "motion-interactive property-card-pointer-glow group relative mx-auto block w-full overflow-hidden rounded-2xl border border-border/55 bg-card text-left shadow-[var(--property-card-shadow)] hover:border-forest/25 hover:shadow-[var(--elevation-2)]",
    selected ? "border-forest ring-2 ring-forest/25" : "",
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
  const monthlyBond = isSale && typeof displayPrice === "number"
    ? calculateMonthlyBond({ purchasePrice: displayPrice }).monthlyRepayment
    : null;
  const agentMeta = property.agent
    ? [property.agent.agency, property.agent.phone].filter(Boolean).join(" · ")
    : "";

  const agentIdentity = property.agent ? (
    <>
      {property.agent.avatarUrl ? (
        <Image
          src={property.agent.avatarUrl}
          alt={property.agent.name}
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <span className="text-xs font-semibold">{property.agent.name.charAt(0)}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold leading-tight text-ink">{property.agent.name}</span>
          {property.agent.isVerified ? <BadgeCheck className="size-3.5 shrink-0 text-forest" aria-label="Phone confirmed" /> : null}
        </div>
        {agentMeta ? (
          <p className="mt-1 truncate text-xs leading-tight text-muted-foreground">{agentMeta}</p>
        ) : null}
      </div>
    </>
  ) : null;

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
      <div className={cn(
        "relative z-0 aspect-[2/1] w-full overflow-hidden rounded-t-2xl",
      )} data-slot="property-card-media">
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
                sizes={compact ? "(max-width: 639px) 88vw, 390px" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
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
        {(property.imageUrls && property.imageUrls.length > 0) && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-ink/55 px-2.5 py-1 text-primary-foreground backdrop-blur-md">
            <Camera className="size-3.5" />
            <span className="text-xs font-semibold">{property.imageUrls.length} {property.imageUrls.length === 1 ? "photo" : "photos"}</span>
          </div>
        )}

        {/* Top Right Action Column — stacked circular floating buttons (close + heart) */}
        <div className="absolute right-3 top-3 z-20 flex flex-col items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose();
              }}
              className="flex size-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-[var(--elevation-1)] backdrop-blur-md transition-colors hover:bg-card hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest active:scale-95"
              aria-label={`Dismiss ${property.title}`}
            >
              <X className="size-4" />
            </button>
          ) : null}
          {showVideoCall ? (
            <ListingVideoCallButton
              listingId={property.id}
              className="size-11 border-transparent bg-card/90 text-ink shadow-[var(--elevation-1)] backdrop-blur-md hover:bg-card hover:text-forest"
            />
          ) : null}
          {action ? <div className="pointer-events-auto">{action}</div> : null}
        </div>

        {/* Scroll Nav Buttons (Desktop) */}
        {property.imageUrls && property.imageUrls.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                const container = e.currentTarget.parentElement?.querySelector('.snap-x');
                if (container) container.scrollBy({ left: -container.clientWidth, behavior: 'smooth' });
              }}
              className="absolute left-2 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-ink opacity-0 shadow-[var(--elevation-1)] backdrop-blur-md transition-opacity hover:bg-card group-hover:opacity-100 sm:flex"
              aria-label={`Previous image of ${property.title}`}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                const container = e.currentTarget.parentElement?.querySelector('.snap-x');
                if (container) container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
              }}
              className="absolute right-2 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-ink opacity-0 shadow-[var(--elevation-1)] backdrop-blur-md transition-opacity hover:bg-card group-hover:opacity-100 sm:flex"
              aria-label={`Next image of ${property.title}`}
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {/* Price capsule bridges the photography and the structured facts. */}
      <div className="pointer-events-none relative z-20 -mt-5 flex justify-center px-5">
        <m.div
          data-slot="property-card-price"
          layoutId={`listing-${property.id}-price`}
          className="pointer-events-auto flex min-h-10 max-w-full items-baseline justify-center gap-1 rounded-full border border-border/55 bg-card px-5 py-2 shadow-[var(--property-card-shadow)]"
        >
          <span className="truncate font-heading text-lg font-bold leading-none tracking-tight text-ink">{formatPrice(displayPrice)}</span>
          {priceSuffix(property) ? (
            <span className="shrink-0 text-[11px] font-semibold leading-none text-muted-foreground">{priceSuffix(property)}</span>
          ) : null}
        </m.div>
      </div>

      {/* Bottom Content Section */}
      <div className="relative bg-card px-4 pb-2 pt-1.5" data-slot="property-card-content">

        {/* Status row: availability is the live signal; "New" flags fresh stock. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold leading-none text-forest">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-forest" />
            {availabilityLabel(property.availabilityDate)}
          </span>
          {isSale ? (
            <span className="inline-flex rounded-full bg-clay/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-clay">
              For sale
            </span>
          ) : null}
          {isNew && (
            <span className="ml-auto inline-flex items-center rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-forest">
              New
            </span>
          )}
          {property.nsfasApproved ? (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-bold text-forest",
              !isNew && "ml-auto",
            )}>
              <ShieldCheck className="size-3" aria-hidden="true" />
              NSFAS Approved
            </span>
          ) : null}
          {property.listingReviewedAt ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-forest",
                !isNew && !property.nsfasApproved && "ml-auto",
              )}
              aria-label={`Listing reviewed by Pinpoint on ${new Date(property.listingReviewedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}. This does not verify identity or property ownership.`}
            >
              <BadgeCheck className="size-3" aria-hidden="true" />
              Listing reviewed
            </span>
          ) : null}
        </div>

        {/* Title */}
        <m.h3 layoutId={`listing-${property.id}-title`} className="mt-1 truncate font-heading text-sm font-semibold leading-tight text-ink">
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

        {/* Features (Beds, Baths) */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink">
          <div className="flex items-center gap-1">
            <BedDouble className="size-3.5" />
            <span className="text-[11px] font-bold">{property.bedrooms ?? "-"} <span className="font-normal text-muted-foreground">bed</span></span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="size-3.5" />
            <span className="text-[11px] font-bold">{property.bathrooms ?? "-"} <span className="font-normal text-muted-foreground">bath</span></span>
          </div>
          {isSale ? (
            <div className="flex items-center gap-1">
              <Building2 className="size-3.5" />
              <span className="text-[11px] font-bold">{property.parkingCount ?? 0} <span className="font-normal text-muted-foreground">garage</span></span>
            </div>
          ) : null}
        </div>

        {monthlyBond !== null ? (
          <p className="mt-1.5 text-[11px] font-semibold text-forest">
            Est. bond {formatPrice(monthlyBond)}/month
          </p>
        ) : null}

        {/* Address */}
        <div className="mt-1 flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <m.p layoutId={`listing-${property.id}-location`} className="truncate text-[11px] text-muted-foreground">
            {property.address ?? property.area ?? "Location to confirm"}
          </m.p>
        </div>

        {/* Agent identity remains available without competing with the price. */}
        {property.agent ? (
          <div className="mt-2 border-t border-border/40 pt-2" data-slot="property-card-agent">
            {property.agent.id ? (
              <Link
                href={`/lister/${property.agent.id}`}
                className="flex min-h-10 items-center gap-2.5 rounded-md hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                onClick={(event) => event.stopPropagation()}
              >
                {agentIdentity}
              </Link>
            ) : (
              <div className="flex min-h-10 items-center gap-2.5">{agentIdentity}</div>
            )}
          </div>
        ) : null}
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
