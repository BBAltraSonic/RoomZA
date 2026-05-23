"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Building2, CalendarDays, Heart, MapPin, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

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
};

function formatPrice(price: number | string) {
  if (typeof price === "string") return price;
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
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
    "group relative mx-auto w-full overflow-hidden shadow-sm transition-all block text-left",
    compact ? "aspect-[6/5] rounded-[24px]" : "aspect-[4/5] rounded-[32px]",
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
      {/* Background Image Carousel & Interactive Layer */}
      <div 
        className="absolute inset-0 z-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-hide pointer-events-auto"
        onScroll={handleScroll}
      >
        {(property.imageUrls?.length ? property.imageUrls : [property.imageUrl]).filter(Boolean).map((url, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center">
            {/* Interactive layer per slide to make the card clickable without nesting buttons */}
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
          <div className="relative h-full w-full shrink-0 snap-center">
            {href ? (
              <Link href={href} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest" aria-label={`View details for ${property.title}`} />
            ) : (
              <button type="button" onClick={onSelect} className="absolute inset-0 z-10 w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest" aria-label={`View details for ${property.title}`} />
            )}
            <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-muted text-muted-foreground transition-transform duration-500 group-hover:scale-105">
              <Building2 className="size-10" />
            </div>
          </div>
        )}
      </div>
      
      {/* Top Left Badge */}
      <div className={cn(
        "pointer-events-none absolute z-10 flex gap-2",
        compact ? "left-3 top-3" : "left-5 top-5"
      )}>
        <div className={cn(
          "rounded-full bg-panel/95 shadow-sm backdrop-blur-sm",
          compact ? "px-3 py-1.5" : "px-4 py-2"
        )}>
          <span className={cn("font-semibold tracking-wide text-forest", compact ? "text-xs" : "text-sm")}>
            {availabilityLabel(property.availabilityDate)}
          </span>
        </div>
        {isNew && (
          <div className={cn(
            "rounded-full bg-forest text-primary-foreground shadow-sm",
            compact ? "px-3 py-1.5" : "px-4 py-2"
          )}>
            <span className={cn("font-bold tracking-wide", compact ? "text-xs" : "text-sm")}>
              New
            </span>
          </div>
        )}
      </div>

      {/* Action Button & Top Right Controls */}
      <div className={cn("absolute z-20 flex flex-col items-end gap-2", compact ? "right-3 top-3" : "right-5 top-5")}>
        {action}
        {property.imageUrls && property.imageUrls.length > 1 && (
          <div className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white backdrop-blur-md">
            {activeImageIndex + 1}/{property.imageUrls.length}
          </div>
        )}
      </div>

      {/* Scroll hint arrow */}
      {property.imageUrls && property.imageUrls.length > 1 && activeImageIndex === 0 && (
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 z-10 flex size-6 items-center justify-center rounded-full bg-black/30 text-white opacity-80 backdrop-blur-sm transition-opacity sm:hidden">
          <ChevronRight className="size-4" />
        </div>
      )}

      {/* Floating Bottom Card */}
      <div className={cn(
        "pointer-events-none absolute bg-panel shadow-xl z-10",
        compact ? "bottom-3 left-3 right-3 rounded-[16px] p-3" : "bottom-4 left-4 right-4 rounded-[20px] p-4"
      )}>
        <div className="flex items-start justify-between">
          <div className={cn("min-w-0 pr-2", compact ? "space-y-0.5" : "space-y-1")}>
            <h3 className={cn("truncate font-bold leading-tight text-ink", compact ? "text-sm" : "text-base")}>
              {property.title}
            </h3>
            <div className="flex items-center text-muted-foreground">
              <MapPin className={cn("shrink-0 text-forest", compact ? "mr-1 size-3" : "mr-1 size-3.5")} fill="currentColor" strokeWidth={1} />
              <span className={cn("truncate font-medium tracking-tight", compact ? "text-[11px]" : "text-xs")}>
                {property.area ?? property.address ?? "Location to confirm"}
              </span>
            </div>
          </div>
          
          <div className={cn(
            "shrink-0 font-semibold rounded-full bg-forest text-primary-foreground flex items-center justify-center transition-colors hover:bg-forest/90", 
            compact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"
          )}>
            Apply
          </div>
        </div>

        {/* Divider */}
        <div className={cn("w-full border-t border-dashed border-border", compact ? "my-2.5" : "my-3")} />

        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-baseline pr-2 truncate">
            <span className={cn("truncate font-extrabold tracking-tight text-ink", compact ? "text-base" : "text-[1.05rem]")}>
              {formatPrice(property.price)}
            </span>
            <span className={cn("ml-1 font-medium text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>/mo</span>
          </div>
          
          <div className={cn("flex shrink-0 items-center", compact ? "gap-2" : "gap-2.5")}>
            <div className="flex items-center">
              <BedDouble className={cn("text-forest", compact ? "mr-0.5 size-3" : "mr-1 size-3.5")} strokeWidth={1.5} />
              <span className={cn("font-medium text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>{property.bedrooms ?? "-"}</span>
            </div>
            <div className="flex items-center">
              <Bath className={cn("text-forest", compact ? "mr-0.5 size-3" : "mr-1 size-3.5")} strokeWidth={1.5} />
              <span className={cn("font-medium text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>{property.bathrooms ?? "-"}</span>
            </div>
          </div>
        </div>
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
