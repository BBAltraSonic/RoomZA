"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Building2, CalendarDays, Heart, MapPin, ChevronRight, ChevronLeft, Camera, Phone, BadgeCheck, Map, Ruler } from "lucide-react";

import { cn } from "@/lib/utils";

export type PropertyCardData = {
  id: string;
  title: string;
  area?: string | null;
  address?: string | null;
  price: number | string;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  sqft?: number | string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  imageAlt?: string;
  availabilityDate?: string | null;
  status?: string | null;
  createdAt?: string | null;
  actionLabel?: string;
  agent?: {
    name: string;
    avatarUrl?: string;
    phone?: string;
    isVerified?: boolean;
    agency?: string;
  } | null;
  listingType?: "For rent" | "For sale";
};

function formatPrice(price: number | string) {
  if (typeof price === "string") return price;
  return `$${new Intl.NumberFormat("en-US").format(price)}`;
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
  action,
  compact = false,
  className,
}: {
  property: PropertyCardData;
  href?: string;
  selected?: boolean;
  onSelect?: () => void;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const classes = cn(
    "group relative mx-auto w-full overflow-visible transition-all block text-left bg-white",
    compact ? "rounded-[20px]" : "rounded-[24px] border border-border/40 shadow-sm hover:shadow-md",
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

  const listingType = property.listingType ?? "For rent";

  return (
    <div className={classes}>
      {/* Top Image Section */}
      <div className={cn(
        "relative w-full overflow-hidden z-0",
        compact ? "aspect-[4/3] rounded-t-[20px]" : "aspect-[16/11] rounded-t-[24px]"
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
                unoptimized
                sizes={compact ? "144px" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
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
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground transition-transform duration-500 group-hover:scale-105">
                <Building2 className="size-10" />
              </div>
            </div>
          )}
        </div>
        
        {/* Top Right Photo Count Badge */}
        {(property.imageUrls && property.imageUrls.length > 0) && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1 text-white backdrop-blur-md">
            <Camera className="size-3.5" />
            <span className="text-xs font-semibold">{property.imageUrls.length}</span>
          </div>
        )}

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
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 hidden size-8 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow-sm backdrop-blur-md transition-opacity hover:bg-white group-hover:opacity-100 sm:flex"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 hidden size-8 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow-sm backdrop-blur-md transition-opacity hover:bg-white group-hover:opacity-100 sm:flex"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {property.agent ? (
        <div className="relative z-20 -mt-7 flex justify-center px-6 pointer-events-none">
          <div className="pointer-events-auto flex min-h-14 w-full max-w-[calc(100%-0.5rem)] items-center gap-3 rounded-full border border-border/40 bg-white px-3 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
            {property.agent.avatarUrl ? (
              <Image src={property.agent.avatarUrl} alt={property.agent.name} width={36} height={36} className="size-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <span className="text-xs font-semibold">{property.agent.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex min-w-0 flex-col pr-2">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-bold leading-tight text-ink">{property.agent.name}</span>
                {property.agent.isVerified && <BadgeCheck className="size-3.5 text-blue-500" />}
              </div>
              {property.agent.phone && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="size-2.5 text-muted-foreground" />
                  <span className="truncate text-xs font-medium leading-tight text-muted-foreground">{property.agent.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom Content Section */}
      <div className={cn("relative bg-white px-6 pb-5 pt-5", compact ? "rounded-b-[20px]" : "rounded-b-[24px]")}>
        
        {/* Type & Actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("inline-flex size-2 rounded-full", listingType === "For sale" ? "bg-orange-500" : "bg-forest")}></span>
            <span className="text-[13px] font-medium text-muted-foreground">
              {listingType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="flex size-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground hover:border-ink hover:text-ink transition-colors">
              <Map className="size-4" />
            </button>
            <button type="button" className="flex size-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground hover:border-red-500 hover:text-red-500 transition-colors">
              <Heart className="size-4" />
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="mb-2">
          <span className="text-2xl font-extrabold tracking-tight text-ink">
            {formatPrice(property.price)}
          </span>
        </div>

        {/* Features (Beds, Baths, Sqft) */}
        <div className="flex items-center gap-4 mb-2 text-ink">
          <div className="flex items-center gap-1.5">
            <BedDouble className="size-4" />
            <span className="text-[13px] font-bold">{property.bedrooms ?? "-"} <span className="font-normal text-muted-foreground">bed</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="size-4" />
            <span className="text-[13px] font-bold">{property.bathrooms ?? "-"} <span className="font-normal text-muted-foreground">bath</span></span>
          </div>
          {property.sqft && (
            <div className="flex items-center gap-1.5">
              <Ruler className="size-4" />
              <span className="text-[13px] font-bold">{property.sqft} <span className="font-normal text-muted-foreground">sqft</span></span>
            </div>
          )}
        </div>

        {/* Address */}
        <div className="mb-4">
          <p className="truncate text-[13px] text-muted-foreground">
            {property.address ?? property.area ?? "Location to confirm"}
          </p>
        </div>

        {/* Listed by */}
        {property.agent?.agency && (
          <div className="border-t border-border/40 pt-3">
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-full border bg-panel/90 text-ink shadow-[var(--elevation-1)] backdrop-blur-sm transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9 sm:rounded-md sm:backdrop-blur-none",
        saved && "border-forest bg-forest text-primary-foreground hover:text-primary-foreground",
      )}
      aria-label={saved ? "Remove from saved" : "Save listing"}
    >
      <Heart className={cn("size-[1.125rem] sm:size-4", saved && "fill-current")} />
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
