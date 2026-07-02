"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Building2, CalendarDays, Heart, MapPin, ChevronRight, ChevronLeft, Camera, Phone, BadgeCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ListingVideoCallButton } from "@/features/chat/listing-video-call-button";

export type PropertyCardData = {
  id: string;
  title: string;
  area?: string | null;
  address?: string | null;
  price: number | string;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  imageAlt?: string;
  availabilityDate?: string | null;
  status?: string | null;
  createdAt?: string | null;
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
function priceSuffix(status?: string | null) {
  if (status && /sale|buy|sold/i.test(status)) return null;
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
    "group relative mx-auto w-full overflow-visible transition-all block text-left bg-card",
    compact ? "rounded-md" : "rounded-lg border border-border/40 shadow-sm hover:shadow-md",
    selected ? "ring-2 ring-offset-2 ring-forest" : "",
    className
  );

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPosition = target.scrollLeft;
    const width = target.clientWidth;
    const index = Math.round(scrollPosition / width);
    if (index !== activeImageIndex) setActiveImageIndex(index);
  };

  const isNew = property.createdAt
    ? new Date().getTime() - new Date(property.createdAt).getTime() < 48 * 60 * 60 * 1000
    : false;

  return (
    <div className={classes}>
      {/* Top Image Section */}
      <div className={cn(
        "relative w-full overflow-hidden z-0",
        compact ? "aspect-[4/3] rounded-t-md" : "aspect-[16/11] rounded-t-lg"
      )}>
        <div 
          className="absolute inset-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto sm:overflow-hidden scrollbar-hide pointer-events-auto"
          onScroll={handleScroll}
        >
          {(property.imageUrls?.length ? property.imageUrls : [property.imageUrl]).filter(Boolean).map((url, i) => (
            <div key={i} className="relative h-full w-full shrink-0 snap-center">
              {href ? (
                <Link href={href} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest" aria-label={`View details for ${property.title}`} />
              ) : (
                <button type="button" onClick={onSelect} className="absolute inset-0 z-10 w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest" aria-label={`View details for ${property.title}`} />
              )}
              <Image
                src={url as string}
                alt={`${property.imageAlt ?? property.title} - Image ${i + 1}`}
                fill
                sizes={compact ? "144px" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </div>
          ))}
          {!(property.imageUrls?.length || property.imageUrl) && (
            <div className="relative h-full w-full shrink-0 snap-center bg-muted">
              {href ? (
                <Link href={href} className="absolute inset-0 z-10 focus-visible:outline-none" aria-label={`View details for ${property.title}`} />
              ) : (
                <button type="button" onClick={onSelect} className="absolute inset-0 z-10 w-full h-full cursor-pointer focus-visible:outline-none" aria-label={`View details for ${property.title}`} />
              )}
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground transition-transform duration-200 group-hover:scale-105">
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
              className="flex size-9 items-center justify-center rounded-full bg-card/90 text-ink shadow-sm backdrop-blur-md transition-colors hover:bg-card hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest active:scale-95"
              aria-label={`Dismiss ${property.title}`}
            >
              <X className="size-4" />
            </button>
          ) : null}
          {showVideoCall ? (
            <ListingVideoCallButton
              listingId={property.id}
              className="size-9 border-transparent bg-card/90 text-ink shadow-sm backdrop-blur-md hover:bg-card hover:text-forest"
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
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 hidden size-8 items-center justify-center rounded-full bg-card/90 text-ink opacity-0 shadow-sm backdrop-blur-md transition-opacity hover:bg-card group-hover:opacity-100 sm:flex"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 hidden size-8 items-center justify-center rounded-full bg-card/90 text-ink opacity-0 shadow-sm backdrop-blur-md transition-opacity hover:bg-card group-hover:opacity-100 sm:flex"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {/* Floating overlap pill: agent (if present) + monthly rent */}
      <div className="relative z-20 -mt-7 flex justify-center px-6 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto flex min-h-14 w-full max-w-[calc(100%-0.5rem)] items-center gap-3 rounded-full border border-border/40 bg-card px-4 py-2 shadow-[var(--elevation-2)]",
            // Without an agent, center the price so it doesn't float awkwardly to one side.
            property.agent ? "justify-between" : "justify-center"
          )}
        >
          {property.agent ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {property.agent.id ? (
                <Link
                  href={`/lister/${property.agent.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  {property.agent.avatarUrl ? (
                    <Image src={property.agent.avatarUrl} alt={property.agent.name} width={36} height={36} className="size-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <span className="text-xs font-semibold">{property.agent.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-bold leading-tight text-ink">{property.agent.name}</span>
                      {property.agent.isVerified && <BadgeCheck className="size-3.5 shrink-0 text-forest" />}
                    </div>
                    {property.agent.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="size-2.5 text-muted-foreground" />
                        <span className="truncate text-xs font-medium leading-tight text-muted-foreground">{property.agent.phone}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ) : (
                <>
                  {property.agent.avatarUrl ? (
                    <Image src={property.agent.avatarUrl} alt={property.agent.name} width={36} height={36} className="size-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <span className="text-xs font-semibold">{property.agent.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-bold leading-tight text-ink">{property.agent.name}</span>
                      {property.agent.isVerified && <BadgeCheck className="size-3.5 shrink-0 text-forest" />}
                    </div>
                    {property.agent.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="size-2.5 text-muted-foreground" />
                        <span className="truncate text-xs font-medium leading-tight text-muted-foreground">{property.agent.phone}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="flex shrink-0 items-baseline gap-1">
            <span className="text-lg font-extrabold tracking-tight text-ink">{formatPrice(property.price)}</span>
            {priceSuffix(property.status) && (
              <span className="text-xs font-semibold text-muted-foreground">{priceSuffix(property.status)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Content Section */}
      <div className={cn("relative bg-card px-6 pb-5 pt-5", compact ? "rounded-b-md" : "rounded-b-lg")}>

        {/* Status row: availability is the live signal; "New" flags fresh stock. */}
        <div className="mb-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-forest">
            <CalendarDays className="size-3.5 text-forest" />
            {availabilityLabel(property.availabilityDate)}
          </span>
          {isNew && (
            <span className="ml-auto inline-flex items-center rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-forest">
              New
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="mb-2 truncate text-[15px] font-bold leading-tight text-ink">
          {property.title}
        </h3>

        {/* Features (Beds, Baths) */}
        <div className="mb-2.5 flex items-center gap-4 text-ink">
          <div className="flex items-center gap-1.5">
            <BedDouble className="size-4" />
            <span className="text-[13px] font-bold">{property.bedrooms ?? "-"} <span className="font-normal text-muted-foreground">bed</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="size-4" />
            <span className="text-[13px] font-bold">{property.bathrooms ?? "-"} <span className="font-normal text-muted-foreground">bath</span></span>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="truncate text-[13px] text-muted-foreground">
            {property.address ?? property.area ?? "Location to confirm"}
          </p>
        </div>

        {/* Listed by */}
        {property.agent?.agency && (
          <div className="mt-3 border-t border-border/40 pt-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              Listed by {property.agent.agency}
            </p>
          </div>
        )}
      </div>
    </div>
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
  const prevSaved = useRef(saved);

  useEffect(() => {
    if (saved && !prevSaved.current) {
      setPopping(true);
      const timer = setTimeout(() => setPopping(false), 340);
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
        "flex size-11 items-center justify-center rounded-full border bg-panel/90 text-ink shadow-[var(--elevation-1)] backdrop-blur-sm transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:size-9 sm:rounded-md sm:backdrop-blur-none",
        saved && "border-forest bg-forest text-primary-foreground hover:text-primary-foreground",
      )}
      aria-label={saved ? "Remove from saved" : "Save listing"}
    >
      <Heart className={cn("size-[1.125rem] sm:size-4", saved && "fill-current", popping && "discovery-save-pop")} />
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
