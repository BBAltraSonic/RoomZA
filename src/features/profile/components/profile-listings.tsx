"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  Bath,
  BedDouble,
  CalendarClock,
  Home,
  MapPin,
  Sparkles,
  Tag,
  Wrench,
} from "lucide-react";

import { discountPercent, formatDealPrice } from "@/features/discovery/deal-schema";
import {
  formatRand,
  formatShortDate,
  propertyHref,
  serviceHref,
  servicePriceLabel,
  specialHref,
  specialKindLabels,
} from "@/features/profile/public-profile-format";
import type {
  PublicProfile,
  PublicProfileServiceItem,
  PublicProfileSpecialItem,
} from "@/features/profile/types";
import { cn } from "@/lib/utils";

type Property = PublicProfile["activeListings"][number];
type Tab = "all" | "homes" | "services" | "specials";

type Props = {
  properties: Property[];
  services: PublicProfileServiceItem[];
  specials: PublicProfileSpecialItem[];
};

export function ProfileListings({ properties, services, specials }: Props) {
  const baseId = useId();
  const tabs = (
    [
      ["homes", "Homes", properties.length],
      ["services", "Services", services.length],
      ["specials", "Specials", specials.length],
    ] as const
  ).filter(([, , count]) => count > 0);
  const total = properties.length + services.length + specials.length;
  const [active, setActive] = useState<Tab>("all");
  const show = (tab: Tab) => active === "all" || active === tab;

  return (
    <div>
      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Filter listings by category"
          className="-mx-4 mb-5 flex overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          <div className="inline-flex shrink-0 gap-1 rounded-full border border-border bg-muted/70 p-1">
            {([["all", "All", total], ...tabs] as const).map(([key, label, count]) => {
              const selected = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`${baseId}-${key}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  onClick={() => setActive(key)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out-expo)] outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9",
                    selected
                      ? "bg-panel text-ink shadow-[var(--elevation-1)]"
                      : "text-muted-foreground hover:text-ink",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "tabular-nums text-xs",
                      selected ? "text-brand-ink" : "text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <ul
        id={`${baseId}-panel`}
        role={tabs.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={tabs.length > 1 ? `${baseId}-${active}` : undefined}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5"
      >
        {show("homes")
          ? properties.map((item) => (
              <li key={`home-${item.id}`}>
                <PropertyTile item={item} />
              </li>
            ))
          : null}
        {show("services")
          ? services.map((item) => (
              <li key={`service-${item.id}`}>
                <ServiceTile item={item} />
              </li>
            ))
          : null}
        {show("specials")
          ? specials.map((item) => (
              <li key={`special-${item.id}`}>
                <SpecialTile item={item} />
              </li>
            ))
          : null}
      </ul>
    </div>
  );
}

function Tile({
  href,
  imageUrl,
  fallbackIcon,
  chip,
  corner,
  price,
  title,
  location,
  meta,
}: {
  href: string;
  imageUrl: string | null;
  fallbackIcon: ReactNode;
  chip: string;
  corner?: string | null;
  price: ReactNode;
  title: string;
  location: string;
  meta?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-panel shadow-[var(--elevation-1)] outline-none transition-[transform,box-shadow,border-color] duration-[var(--motion-standard)] ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-forest/20 hover:shadow-[var(--elevation-2)] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
    >
      <div className={cn("relative aspect-[16/11] overflow-hidden", imageUrl ? "bg-media-surface" : "bg-warm-surface")}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
            className="object-cover transition-transform duration-[var(--motion-slow)] ease-[var(--ease-out-expo)] group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(90%_80%_at_50%_45%,color-mix(in_oklch,var(--brand-amber)_14%,transparent),transparent_70%)]">
            <span className="grid size-16 place-items-center rounded-full border border-border bg-panel text-brand-ink shadow-[var(--elevation-1)] transition-transform duration-[var(--motion-slow)] ease-[var(--ease-out-expo)] group-hover:scale-[1.04] motion-reduce:transform-none">
              {fallbackIcon}
            </span>
          </div>
        )}
        {imageUrl ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent" />
        ) : null}
        <span
          className={cn(
            "absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
            imageUrl ? "bg-black/55 text-white backdrop-blur-sm" : "border border-border bg-panel text-ink",
          )}
        >
          {chip}
        </span>
        {corner ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-selection px-2.5 py-1 text-[11px] font-semibold text-selection-foreground">
            {corner}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[17px] font-semibold tracking-tight text-ink">
          {price}
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-ink/90">
          {title}
        </h3>
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </p>
        {meta ? (
          <div className="mt-auto pt-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
              {meta}
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function PropertyTile({ item }: { item: Property }) {
  return (
    <Tile
      href={propertyHref(item.id)}
      imageUrl={item.imageUrl}
      fallbackIcon={<Home className="size-6" aria-hidden="true" />}
      chip={item.listingType === "rent" ? "For rent" : "For sale"}
      price={
        <>
          <span>{formatRand(item.price)}</span>
          {item.listingType === "rent" ? (
            <span className="text-sm font-medium text-muted-foreground">/ month</span>
          ) : null}
        </>
      }
      title={item.title}
      location={item.address}
      meta={
        <>
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="size-3.5" aria-hidden="true" />
            {item.bedrooms} {item.bedrooms === 1 ? "bed" : "beds"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bath className="size-3.5" aria-hidden="true" />
            {item.bathrooms} {item.bathrooms === 1 ? "bath" : "baths"}
          </span>
        </>
      }
    />
  );
}

function ServiceTile({ item }: { item: PublicProfileServiceItem }) {
  const price = servicePriceLabel(item);
  return (
    <Tile
      href={serviceHref(item.id)}
      imageUrl={item.imageUrl}
      fallbackIcon={<Wrench className="size-6" aria-hidden="true" />}
      chip={item.serviceType === "Other" ? "Service" : item.serviceType}
      price={
        price ? (
          <>
            <span>{price.price}</span>
            {price.suffix ? (
              <span className="text-sm font-medium text-muted-foreground">{price.suffix}</span>
            ) : null}
          </>
        ) : (
          <span className="text-base">Quote on request</span>
        )
      }
      title={item.title}
      location={item.address}
      meta={
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Wrench className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.providerName}</span>
        </span>
      }
    />
  );
}

function SpecialTile({ item }: { item: PublicProfileSpecialItem }) {
  const discount = discountPercent(item.priceCents ?? undefined, item.originalPriceCents ?? undefined);
  const upcoming = item.state === "upcoming";
  return (
    <Tile
      href={specialHref(item)}
      imageUrl={item.imageUrl}
      fallbackIcon={
        item.kind === "shopping" ? (
          <Tag className="size-6" aria-hidden="true" />
        ) : (
          <Sparkles className="size-6" aria-hidden="true" />
        )
      }
      chip={specialKindLabels[item.kind]}
      corner={discount ? `${discount}% off` : null}
      price={
        item.priceCents !== null ? (
          <>
            <span>{formatDealPrice(item.priceCents)}</span>
            {item.originalPriceCents !== null ? (
              <s className="text-sm font-medium text-muted-foreground">
                <span className="sr-only">was </span>
                {formatDealPrice(item.originalPriceCents)}
              </s>
            ) : null}
          </>
        ) : (
          <span className="text-base">{item.venueName}</span>
        )
      }
      title={item.title}
      location={item.priceCents !== null ? `${item.venueName} · ${item.address}` : item.address}
      meta={
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {upcoming
            ? `Starts ${formatShortDate(item.startsAt)}`
            : `Until ${formatShortDate(item.endsAt)}`}
        </span>
      }
    />
  );
}
