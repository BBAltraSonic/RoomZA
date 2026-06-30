"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Bath,
  BedDouble,
  CalendarDays,
  Car,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Droplets,
  Heart,
  Loader2,
  MapPin,
  MessageSquare,
  Sofa,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ApplicationModal } from "@/features/applications/application-modal";
import { getOrCreateInquiryConversation } from "@/features/chat/actions";
import { ImageLightbox } from "@/components/premium/image-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/premium/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { authPathForRedirect } from "@/lib/redirects";

import { useFavorites } from "./hooks/use-favorites";
import {
  amenityCategories,
  amenityLabels,
  leaseDurationLabels,
  parkingTypeLabels,
  propertyTypeLabels,
  waterTypeLabels,
  type AmenitiesData,
  type AmenityCategory,
} from "../listings/schema";
import {
  calculateTrueMonthlyCost,
  formatRand,
  type HouseholdSize,
  type TransportMethod,
} from "../listings/true-monthly-cost";
import { EssentialRadiusScore } from "./essential-radius-score";
import { useEssentialRadius } from "./hooks/use-essential-radius";

type ListingImage = {
  id: string;
  public_url: string;
  sort_order: number;
};

export type ListingDetail = {
  id: string;
  title: string;
  address: string;
  price: number;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  property_type?: string | null;
  parking_type: string;
  parking_count: number;
  electricity_type: string;
  water_availability: string;
  electricity_included?: boolean | null;
  electricity_estimate?: number | null;
  water_included?: boolean | null;
  water_estimate?: number | null;
  wifi_available?: boolean | null;
  wifi_included?: boolean | null;
  wifi_estimate?: number | null;
  parking_included?: boolean | null;
  parking_estimate?: number | null;
  security_fee_estimate?: number | null;
  lease_duration: string;
  availability_date: string;
  created_at: string;
  metadata: { amenities?: AmenitiesData } | null;
  images: ListingImage[];
};

type ListingDetailPanelProps = {
  listing: ListingDetail;
  initialIntent?: "apply" | "message";
  onBack?: () => void;
  onScroll?: (event: React.UIEvent<HTMLElement>) => void;
  /**
   * Renders the panel for a narrow rail (desktop ~30% width): tighter padding,
   * smaller spacing and grids that stay at two columns instead of expanding via
   * the viewport-based `sm:` breakpoints.
   */
  compact?: boolean;
};

import { formatPrice } from "@/lib/utils";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ImageCarousel({ images, title }: { images: ListingImage[]; title: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-border bg-muted">
        <p className="text-sm text-muted-foreground">No photos uploaded</p>
      </div>
    );
  }

  return (
    <div>
      <div className="group relative aspect-[16/10] overflow-hidden bg-muted sm:mx-0 sm:rounded-lg">
        <div className="absolute inset-0 cursor-pointer" onClick={() => setLightboxOpen(true)}>
          {images[currentIndex] ? (
            <Image
              src={images[currentIndex].public_url}
              alt={title}
              fill
              unoptimized
              sizes="(min-width: 1024px) 540px, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : null}
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="mobile-fab absolute left-3 top-1/2 -translate-y-1/2 border border-border/40 opacity-0 transition-opacity group-hover:opacity-100 sm:!size-9 sm:!rounded-md sm:!bg-panel"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="mobile-fab absolute right-3 top-1/2 -translate-y-1/2 border border-border/40 opacity-0 transition-opacity group-hover:opacity-100 sm:!size-9 sm:!rounded-md sm:!bg-panel"
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold tracking-wide text-primary-foreground backdrop-blur-md">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        ) : null}
      </div>

      {/* Thumbnail strip — quick jump between photos, active one highlighted. */}
      {images.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-0">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`View photo ${i + 1} of ${images.length}`}
              aria-current={i === currentIndex}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
                i === currentIndex
                  ? "border-forest ring-2 ring-forest/40"
                  : "border-border/50 opacity-70 hover:opacity-100",
              )}
            >
              <Image
                src={image.public_url}
                alt={`${title} photo ${i + 1}`}
                fill
                unoptimized
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <ImageLightbox
        images={images}
        initialIndex={currentIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={title}
      />
    </div>
  );
}

function TrueMonthlyCostCard({ listing, compact }: { listing: ListingDetail; compact?: boolean }) {
  const [householdSize, setHouseholdSize] = useState<HouseholdSize>(1);
  const [transportMethod, setTransportMethod] = useState<TransportMethod>("none");
  const [workplaceLabel, setWorkplaceLabel] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const estimate = useMemo(
    () =>
      calculateTrueMonthlyCost(listing, {
        householdSize,
        transportMethod,
        workplaceLabel: workplaceLabel.trim(),
        monthlyTransportCost: Number(transportCost) || 0,
      }),
    [householdSize, listing, transportCost, transportMethod, workplaceLabel],
  );

  const largestAmount = Math.max(...estimate.rows.map((row) => row.amount), 1);

  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-forest" />
            <h2 className="text-sm font-semibold text-ink">True Monthly Cost</h2>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {formatRand(estimate.total)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/month</span>
          </p>
        </div>
        <StatusBadge tone="neutral">Estimate</StatusBadge>
      </div>

      <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <div>
          <Label htmlFor="household-size" className="text-xs font-semibold uppercase text-muted-foreground">
            Household
          </Label>
          <Select value={String(householdSize)} onValueChange={(value) => setHouseholdSize(Number(value) as HouseholdSize)}>
            <SelectTrigger id="household-size" className="mt-2 w-full bg-panel shadow-none focus:ring-ring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size === 5 ? "5+ people" : `${size} ${size === 1 ? "person" : "people"}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="transport-method" className="text-xs font-semibold uppercase text-muted-foreground">
            Transport
          </Label>
          <Select value={transportMethod} onValueChange={(value) => setTransportMethod(value as TransportMethod)}>
            <SelectTrigger id="transport-method" className="mt-2 w-full bg-panel shadow-none focus:ring-ring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not added</SelectItem>
              <SelectItem value="taxi">Taxi</SelectItem>
              <SelectItem value="public_transport">Bus or rail</SelectItem>
              <SelectItem value="driving">Driving</SelectItem>
              <SelectItem value="uber">Uber/e-hailing</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="workplace-label" className="text-xs font-semibold uppercase text-muted-foreground">
            Workplace
          </Label>
          <Input
            id="workplace-label"
            value={workplaceLabel}
            onChange={(event) => setWorkplaceLabel(event.target.value)}
            placeholder="Century City"
            className="mt-2 bg-panel shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
          />
        </div>

        <div>
          <Label htmlFor="transport-cost" className="text-xs font-semibold uppercase text-muted-foreground">
            Monthly commute
          </Label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              R
            </span>
            <Input
              id="transport-cost"
              type="number"
              min={0}
              value={transportCost}
              onChange={(event) => setTransportCost(event.target.value)}
              placeholder="1200"
              className="bg-panel pl-8 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
            />
          </div>
        </div>
      </div>

      {estimate.warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          {estimate.warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-text">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{warning}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 divide-y divide-border rounded-md border border-border bg-panel">
        {estimate.rows.map((row) => {
          const isExpanded = expandedCategory === row.category;
          const width = `${Math.max(4, (row.amount / largestAmount) * 100)}%`;

          return (
            <div key={row.category} className="px-3 py-2.5">
              <button
                type="button"
                onClick={() => setExpandedCategory(isExpanded ? null : row.category)}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{row.label}</span>
                    <span className="text-sm font-semibold text-ink">{formatRand(row.amount)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-forest/70" style={{ width }} />
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>
              {isExpanded ? (
                <div className="mt-2 flex items-start justify-between gap-3 text-xs text-muted-foreground">
                  <p>{row.detail}</p>
                  <span className="shrink-0 rounded-md bg-warm-surface px-2 py-1 font-medium text-ink">{row.source}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ListingDetailPanel({ listing, initialIntent, onBack, onScroll, compact }: ListingDetailPanelProps) {
  const amenities = (listing.metadata as { amenities?: AmenitiesData } | null)?.amenities;
  const hasAmenities = amenities && Object.values(amenities).some((arr) => arr.length > 0);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isMessaging, setIsMessaging] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const router = useRouter();
  const favorited = isFavorite(listing.id);
  const { score, isLoading: isLoadingScore } = useEssentialRadius(listing);

  async function handleMessage() {
    setIsMessaging(true);
    setMessageError(null);
    try {
      const res = await getOrCreateInquiryConversation(listing.id);
      if (res.success && res.conversationId) {
        router.push(`/messages/${res.conversationId}`);
      } else {
        const errorMessage = res.error || "Failed to start conversation.";
        if (errorMessage === "Unauthenticated") {
          setMessageError("Sign in to message the landlord about this home.");
        } else {
          setMessageError(errorMessage);
          toast.error(errorMessage);
        }
      }
    } catch {
      setMessageError("An unexpected error occurred. Please try again.");
    } finally {
      setIsMessaging(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-panel text-ink">
      {/* Mobile: image hero first with floating FABs */}
      <div className="relative sm:hidden">
        <ImageCarousel images={listing.images} title={listing.title} />
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mobile-fab absolute left-4 top-4"
            aria-label="Back to homes"
          >
            <ArrowLeft className="size-[1.125rem] text-ink" />
          </button>
        ) : null}
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleFavorite(listing.id)}
            className={cn(
              "mobile-fab",
              favorited && "!bg-forest text-primary-foreground",
            )}
            aria-label={favorited ? "Remove from saved" : "Save listing"}
          >
            <Heart className={cn("size-[1.125rem]", favorited ? "fill-current" : "text-ink")} />
          </button>
        </div>
      </div>

      {/* Desktop: header with back button and info */}
      <div className={cn("border-b border-border p-4", compact ? "sm:p-4" : "sm:p-5")}>
        {/* Desktop back button */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 hidden items-center gap-2 text-sm font-medium text-forest hover:text-forest/80 sm:inline-flex"
          >
            <ArrowLeft className="size-4" />
            Back to homes
          </button>
        ) : null}

        {/* Calm meta line: a single availability badge, with the listed-on
            timestamp demoted to quiet inline text so it doesn't compete. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusBadge tone="forest">Available {formatDate(listing.availability_date)}</StatusBadge>
          {(() => {
            const daysAgo = Math.floor((new Date().getTime() - new Date(listing.created_at).getTime()) / (1000 * 3600 * 24));
            let label: string | null = null;
            if (daysAgo === 0) label = "Listed today";
            else if (daysAgo === 1) label = "Listed yesterday";
            else if (daysAgo < 30) label = `Listed ${daysAgo} days ago`;
            return label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null;
          })()}
        </div>

        {/* Title — the primary focal point */}
        <h1 className="mt-3 line-clamp-2 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
          {listing.title}
        </h1>

        {/* Address */}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0 text-clay" />
          <span className="truncate">{listing.address}</span>
        </p>

        {/* Price — secondary focal point — with the save action aligned to it
            (desktop only; mobile uses the floating heart on the image hero). */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <p className="text-[1.75rem] font-bold tracking-tight text-ink sm:text-3xl">
            {formatPrice(listing.price)}
            <span className="ml-1.5 text-sm font-medium text-muted-foreground">/month</span>
          </p>
          <button
            type="button"
            onClick={() => toggleFavorite(listing.id)}
            className={cn(
              "hidden size-10 shrink-0 items-center justify-center rounded-md border shadow-[var(--elevation-1)] transition-colors sm:flex",
              favorited
                ? "border-forest bg-forest text-primary-foreground"
                : "border-border bg-panel text-ink hover:border-forest hover:text-forest",
            )}
            aria-label={favorited ? "Remove from saved" : "Save listing"}
          >
            <Heart className={cn("size-4", favorited && "fill-current")} />
          </button>
        </div>
      </div>

      <div className={cn("flex-1 overflow-y-auto scrollbar-hide", compact ? "space-y-4 p-4" : "space-y-5 p-4 sm:space-y-6 sm:p-5")} onScroll={onScroll}>
        {/* Desktop: image carousel inside scroll */}
        <div className="hidden sm:block">
          <ImageCarousel images={listing.images} title={listing.title} />
        </div>

        <TrueMonthlyCostCard listing={listing} compact={compact} />

        <div className={cn("grid grid-cols-2 gap-2", compact ? "" : "sm:grid-cols-4 sm:gap-3")}>
          {/* Type — property type with the room/bedroom count as the sub-label */}
          <div className="flex flex-col items-center rounded-xl border border-border bg-warm-surface px-2 py-3 text-center sm:flex-row sm:items-center sm:gap-3 sm:rounded-md sm:px-3 sm:py-2.5 sm:text-left">
            <BedDouble className="size-5 text-forest sm:size-4" />
            <div className="mt-1.5 sm:mt-0">
              <p className="text-sm font-semibold text-ink">
                {propertyTypeLabels[listing.property_type as keyof typeof propertyTypeLabels] ?? listing.property_type ?? "Home"}
              </p>
              <p className="text-[0.65rem] text-muted-foreground sm:text-xs">
                {listing.bedrooms > 0
                  ? `${listing.bedrooms} ${listing.bedrooms === 1 ? "Bedroom" : "Bedrooms"}`
                  : "Open plan"}
              </p>
            </div>
          </div>

          {/* Bathrooms */}
          <div className="flex flex-col items-center rounded-xl border border-border bg-warm-surface px-2 py-3 text-center sm:flex-row sm:items-center sm:gap-3 sm:rounded-md sm:px-3 sm:py-2.5 sm:text-left">
            <Bath className="size-5 text-forest sm:size-4" />
            <div className="mt-1.5 sm:mt-0">
              <p className="text-sm font-semibold text-ink">{listing.bathrooms}</p>
              <p className="text-[0.65rem] text-muted-foreground sm:text-xs">
                {listing.bathrooms === 1 ? "Bathroom" : "Bathrooms"}
              </p>
            </div>
          </div>

          {/* Parking */}
          <div className="flex flex-col items-center rounded-xl border border-border bg-warm-surface px-2 py-3 text-center sm:flex-row sm:items-center sm:gap-3 sm:rounded-md sm:px-3 sm:py-2.5 sm:text-left">
            <Car className="size-5 text-forest sm:size-4" />
            <div className="mt-1.5 sm:mt-0">
              <p className="text-sm font-semibold text-ink">{parkingTypeLabels[listing.parking_type as keyof typeof parkingTypeLabels] ?? listing.parking_type}</p>
              <p className="text-[0.65rem] text-muted-foreground sm:text-xs">Parking</p>
            </div>
          </div>

          {/* Furnished — derived from the essentials amenities. */}
          <div className="flex flex-col items-center rounded-xl border border-border bg-warm-surface px-2 py-3 text-center sm:flex-row sm:items-center sm:gap-3 sm:rounded-md sm:px-3 sm:py-2.5 sm:text-left">
            <Sofa className="size-5 text-forest sm:size-4" />
            <div className="mt-1.5 sm:mt-0">
              <p className="text-sm font-semibold text-ink">
                {amenities?.essentials?.includes("furnished") ? "Furnished" : "Unfurnished"}
              </p>
              <p className="text-[0.65rem] text-muted-foreground sm:text-xs">
                {amenities?.essentials?.includes("furnished") ? "Move-in ready" : "Bring your own"}
              </p>
            </div>
          </div>
        </div>

        <EssentialRadiusScore score={score} isLoading={isLoadingScore} />

        <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
          <h2 className="text-sm font-semibold text-ink">Lease and utilities</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Lease</span>
              <span className="text-right font-medium text-ink">
                {leaseDurationLabels[listing.lease_duration as keyof typeof leaseDurationLabels] ?? listing.lease_duration}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Droplets className="size-4" />
                Water
              </span>
              <span className="text-right font-medium text-ink">
                {waterTypeLabels[listing.water_availability as keyof typeof waterTypeLabels] ?? listing.water_availability}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="size-4" />
                Available
              </span>
              <span className="text-right font-medium text-ink">{formatDate(listing.availability_date)}</span>
            </div>
          </div>
        </section>

        {hasAmenities ? (
          <section>
            <h2 className="text-sm font-semibold text-ink">Amenities</h2>
            <div className="mt-3 space-y-4">
              {(Object.entries(amenityCategories) as [AmenityCategory, (typeof amenityCategories)[AmenityCategory]][]).map(
                ([categoryKey, category]) => {
                  const selected = amenities[categoryKey] ?? [];
                  if (selected.length === 0) return null;

                  return (
                    <div key={categoryKey}>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        {category.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selected.map((item) => (
                          <StatusBadge key={item} tone="neutral">
                            {amenityLabels[item] ?? item}
                          </StatusBadge>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </section>
        ) : null}
      </div>

      <div
        className="border-t border-border bg-panel p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        {messageError ? (
          <div className="mb-3 rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-text">
            <p>{messageError}</p>
            {messageError.startsWith("Sign in") ? (
              <Link
                href={authPathForRedirect(`/listing/${listing.id}?intent=message`)}
                className="mt-1 inline-flex font-semibold text-forest hover:underline"
              >
                Sign in to continue
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-stretch gap-3">
          <Button
            onClick={handleMessage}
            disabled={isMessaging}
            aria-label={initialIntent === "message" ? "Continue message" : "Message the landlord"}
            className="h-12 shrink-0 rounded-xl border-border bg-panel px-5 text-ink hover:bg-warm-surface disabled:opacity-50 sm:h-11 sm:rounded-md"
            variant="outline"
          >
            {isMessaging ? <Loader2 className="size-4 animate-spin sm:mr-1.5" /> : <MessageSquare className="size-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">{initialIntent === "message" ? "Continue message" : "Message"}</span>
          </Button>
          <ApplicationModal
            listingId={listing.id}
            initialOpen={initialIntent === "apply"}
            trigger={
              <Button className="h-12 flex-1 rounded-xl bg-forest text-base font-semibold text-primary-foreground hover:bg-forest/90 sm:h-11 sm:rounded-md">
                Apply now
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
