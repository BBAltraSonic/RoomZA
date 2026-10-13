"use client";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import type { PublicContact } from "@/features/guest-contact/schema";


import { useEffect, useRef, useState } from "react";
import { DiscoveryCard } from "./discovery-card";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  CarFront,
  Heart,
  ShieldCheck,
  Sofa,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { isNewListing } from "@/features/listings/listing-freshness";

import { MOTION_CELEBRATION_MS } from "@/lib/motion/tokens";
import { SuccessFeedback } from "@/lib/motion/primitives";
import {
  selectLandlordTrustSignals,
  type LandlordTrustSummary,
} from "@/features/trust/landlord-signals";
import type { PresenceBadge as PresenceBadgeValue } from "@/features/presence/presence-status";
import type { UpcomingLiveTour } from "@/features/live-tours/types";
import type { ListingLiveActivity } from "@/features/map-discovery/live-activity";

export type PropertyCardData = {
  publicContact?: PublicContact | null;
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
  furnished?: boolean;
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
  presentation = "standard",
}: {
  property: PropertyCardData;
  href?: string;
  selected?: boolean;
  onSelect?: () => void;
  action?: React.ReactNode;
  className?: string;
  presentation?: "standard" | "desktop-results";
}) {
  const isDesktopResults = presentation === "desktop-results";
  const isNew = isNewListing(property.createdAt);
  const isSale = property.listingType === "sale";
  const displayPrice = property.displayPrice ?? (isSale ? property.salePrice ?? property.price : property.price);
  const signals = cardSignals(property, isNew, isSale).map((signal) => ({
    ...signal,
    icon: signal.icon === "nsfas" ? <ShieldCheck className="size-3 shrink-0" aria-hidden="true" />
      : signal.icon === "reviewed" ? <BadgeCheck className="size-3 shrink-0" aria-hidden="true" /> : undefined,
  }));

  return (
    <DiscoveryCard
      category="property"
      slotPrefix="property-card"
      layoutId={`listing-${property.id}`}
      headingLevel={3}
      truncate
      title={property.title}
      location={property.address ?? property.area ?? "Location to confirm"}
      emphasis={formatPrice(displayPrice)}
      emphasisSuffix={priceSuffix(property)}
      href={href}
      actionLabel={`View details for ${property.title}`}
      selected={selected}
      onSelect={onSelect}
      className={className}
      presentation={presentation}
      media={{
        imageUrls: (property.imageUrls?.length ? property.imageUrls : [property.imageUrl]).filter((url): url is string => Boolean(url)),
        imageAlt: property.imageAlt ?? property.title,
        placeholder: <Building2 className="size-10" aria-hidden="true" />,
        action,
        loadingTestId: "listing-image-loading",
        fallbackTestId: "listing-image-placeholder",
      }}
      features={<>
        <span className="inline-flex items-center gap-1">
          <BedDouble className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {property.bedrooms ?? "-"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Bath className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {property.bathrooms ?? "-"}
        </span>
        {isDesktopResults && Number(property.parkingCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1">
            <CarFront className="size-3.5 text-muted-foreground" aria-hidden="true" />{property.parkingCount}
          </span>
        ) : null}
        {isDesktopResults && property.furnished ? (
          <span className="inline-flex items-center gap-1">
            <Sofa className="size-3.5 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Furnished</span>
          </span>
        ) : null}
      </>}
      actions={<ContactActions contact={property.publicContact} title={property.title} />}
      signals={signals}
    />
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
