"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import {
  ArrowLeft,
  AlertTriangle,
  Bath,
  BedDouble,
  CalendarDays,
  Car,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDot,
  Droplets,
  Heart,
  MapPin,
  MessageSquare,
  Share2,
  Sofa,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApplicationModal } from "@/features/applications/application-modal";
import { ReportPanel } from "@/features/admin/components/report-panel";
import { LandlordTrustSignals } from "@/features/trust/components/landlord-trust-signals";
import type { LandlordTrustSummary } from "@/features/trust/landlord-signals";
import { getOrCreateInquiryConversation } from "@/features/chat/actions";
import { contactSellerForPurchase, requestPurchaseViewing } from "@/features/purchase/actions";
import { calculateMonthlyBond, DEFAULT_BOND_INTEREST_RATE, DEFAULT_BOND_TERM_YEARS } from "@/features/purchase/bond-calculator";
import { PURCHASE_STAGES, purchaseStageLabels, stageState, type PurchaseStage } from "@/features/purchase/progress";
import { ImageLightbox } from "@/components/premium/image-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/premium/primitives";
import { PendingGlyph } from "@/lib/motion/primitives";
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
import { buildListingShareUrl, shareListing } from "./lib/listing-share";
import { ManualCopyPopover } from "./manual-copy-popover";

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
  sale_price?: number | null;
  display_price?: number | null;
  listing_type?: "rent" | "sale";
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
  listing_reviewed_at?: string | null;
  landlordTrust?: LandlordTrustSummary | null;
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
        <button
          type="button"
          className="absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => setLightboxOpen(true)}
          aria-label={`Open gallery for ${title}`}
        >
          {images[currentIndex] ? (
            <Image
              src={images[currentIndex].public_url}
              alt={title}
              fill
              sizes="(min-width: 1024px) 540px, 100vw"
              className="object-cover transition-transform duration-[var(--motion-standard)] group-hover:scale-[1.02] motion-reduce:transform-none"
            />
          ) : null}
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="mobile-fab absolute left-3 top-1/2 -translate-y-1/2 border border-border/40 opacity-100 transition-opacity sm:!size-9 sm:!rounded-md sm:!bg-panel sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="mobile-fab absolute right-3 top-1/2 -translate-y-1/2 border border-border/40 opacity-100 transition-opacity sm:!size-9 sm:!rounded-md sm:!bg-panel sm:opacity-0 sm:group-hover:opacity-100"
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
        imageAction={(image) => (
          <ReportPanel
            listingImageId={image.id}
            label="Report photo"
            popover
            compact
            className="text-primary-foreground [&>summary]:text-primary-foreground [&>summary]:hover:text-primary-foreground"
          />
        )}
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

function BondCalculatorCard({ listing, compact }: { listing: ListingDetail; compact?: boolean }) {
  const purchasePrice = listing.display_price ?? listing.sale_price ?? listing.price;
  const [deposit, setDeposit] = useState(() => String(Math.round(purchasePrice * 0.1)));
  const [interestRate, setInterestRate] = useState(String(DEFAULT_BOND_INTEREST_RATE));
  const [loanTerm, setLoanTerm] = useState(String(DEFAULT_BOND_TERM_YEARS));

  const estimate = useMemo(
    () =>
      calculateMonthlyBond({
        purchasePrice,
        deposit: Number(deposit) || 0,
        annualInterestRate: Number(interestRate) || DEFAULT_BOND_INTEREST_RATE,
        loanTermYears: Number(loanTerm) || DEFAULT_BOND_TERM_YEARS,
      }),
    [deposit, interestRate, loanTerm, purchasePrice],
  );

  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-forest" />
            <h2 className="text-sm font-semibold text-ink">Bond estimate</h2>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {formatRand(estimate.monthlyRepayment)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/month</span>
          </p>
        </div>
        <StatusBadge tone="neutral">Estimate</StatusBadge>
      </div>

      <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <MoneyInput id="bond-price" name="bond-price" label="Purchase price" value={purchasePrice} readOnly />
        <MoneyInput id="bond-deposit" name="bond-deposit" label="Deposit" value={deposit} onChange={setDeposit} />
        <NumberInput id="bond-rate" label="Interest rate" suffix="%" value={interestRate} onChange={setInterestRate} step="0.25" />
        <NumberInput id="bond-term" label="Loan term" suffix="years" value={loanTerm} onChange={setLoanTerm} step="1" />
      </div>
    </section>
  );
}

function PurchaseProgressTimeline({
  currentStage,
  completedStages,
  compact,
}: {
  currentStage: PurchaseStage;
  completedStages: PurchaseStage[];
  compact?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Purchase progress</h2>
        <span className="rounded-md bg-panel px-2 py-1 text-xs font-semibold text-muted-foreground shadow-[var(--neu-inset-sm)]">
          {completedStages.length}/{PURCHASE_STAGES.length}
        </span>
      </div>
      <ol className={cn("mt-4 grid gap-3", compact ? "" : "sm:grid-cols-2")}>
        {PURCHASE_STAGES.map((stage, index) => {
          const state = stageState(stage, currentStage, completedStages);
          const Icon = state === "complete" ? CheckCircle2 : state === "current" ? CircleDot : Circle;
          return (
            <li key={stage} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-panel",
                  state === "complete" && "border-forest bg-forest text-primary-foreground",
                  state === "current" && "border-clay text-clay",
                  state === "upcoming" && "border-border text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", state === "upcoming" ? "text-muted-foreground" : "text-ink")}>
                  {purchaseStageLabels[stage]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state === "complete" ? "Completed" : state === "current" ? "Current milestone" : `Step ${index + 1}`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MoneyInput({
  id,
  name,
  label,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  name: string;
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </Label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R</span>
        <Input
          id={id}
          name={name}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
          className="bg-panel pl-8 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
        />
      </div>
    </div>
  );
}

function NumberInput({
  id,
  label,
  suffix,
  value,
  onChange,
  step,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </Label>
      <div className="relative mt-2">
        <Input
          id={id}
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bg-panel pr-16 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

export function ListingDetailPanel({ listing, initialIntent, onBack, onScroll, compact }: ListingDetailPanelProps) {
  const amenities = (listing.metadata as { amenities?: AmenitiesData } | null)?.amenities;
  const hasAmenities = amenities && Object.values(amenities).some((arr) => arr.length > 0);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isMessaging, setIsMessaging] = useState(false);
  const [isRequestingViewing, setIsRequestingViewing] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const sharePendingRef = useRef(false);
  const shareTriggerRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const favorited = isFavorite(listing.id);
  const isSale = listing.listing_type === "sale";
  const displayPrice = listing.display_price ?? listing.sale_price ?? listing.price;
  const [recordedPurchaseStages, setRecordedPurchaseStages] = useState<PurchaseStage[]>([]);
  const completedPurchaseStages = useMemo(() => {
    if (isSale && favorited && !recordedPurchaseStages.includes("property_saved")) {
      return ["property_saved" as PurchaseStage, ...recordedPurchaseStages];
    }
    return recordedPurchaseStages;
  }, [favorited, isSale, recordedPurchaseStages]);

  const currentPurchaseStage = PURCHASE_STAGES.find((stage) => !completedPurchaseStages.includes(stage)) ?? "purchase_complete";

  function markPurchaseStage(stage: PurchaseStage) {
    setRecordedPurchaseStages((current) => (current.includes(stage) ? current : [...current, stage]));
  }

  async function handleFavoriteToggle() {
    await toggleFavorite(listing.id, { listingType: listing.listing_type });
    if (isSale && !favorited) {
      markPurchaseStage("property_saved");
    }
  }

  const closeManualCopy = useCallback(() => {
    setManualCopyUrl(null);
    shareTriggerRef.current?.focus();
  }, []);

  async function handleShare(event: React.MouseEvent<HTMLButtonElement>) {
    if (sharePendingRef.current) return;

    sharePendingRef.current = true;
    shareTriggerRef.current = event.currentTarget;
    setIsSharing(true);
    setManualCopyUrl(null);
    setShareStatus("Sharing listing");

    const url = buildListingShareUrl(window.location.origin, listing.id);
    try {
      const outcome = await shareListing({ title: listing.title, text: listing.address, url });

      if (outcome === "shared") {
        setShareStatus("Property shared");
        toast.success("Property shared");
      } else if (outcome === "copied") {
        setShareStatus("Listing link copied");
        toast.success("Link copied");
      } else if (outcome === "cancelled") {
        setShareStatus("Sharing cancelled");
      } else {
        setManualCopyUrl(url);
        setShareStatus("Automatic copying is unavailable. Copy the selected listing link manually.");
      }
    } catch {
      setManualCopyUrl(url);
      setShareStatus("Automatic copying is unavailable. Copy the selected listing link manually.");
      toast.error("Could not share this property");
    } finally {
      sharePendingRef.current = false;
      setIsSharing(false);
    }
  }

  async function handleMessage() {
    setIsMessaging(true);
    setMessageError(null);
    try {
      const res = isSale ? await contactSellerForPurchase(listing.id) : await getOrCreateInquiryConversation(listing.id);
      const conversationId = res.success ? ("data" in res ? res.data.conversationId : res.conversationId) : null;
      if (conversationId) {
        if (isSale) markPurchaseStage("contacted_seller");
        router.push(`/messages/${conversationId}`);
      } else {
        const errorMessage = ("error" in res ? res.error : undefined) ?? "Failed to start conversation.";
        if (errorMessage === "Unauthenticated") {
          setMessageError(isSale ? "Sign in to contact the seller about this property." : "Sign in to message the landlord about this home.");
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

  async function handleScheduleViewing() {
    setIsRequestingViewing(true);
    setMessageError(null);
    try {
      const result = await requestPurchaseViewing(listing.id);
      if (result.success) {
        markPurchaseStage("viewing_scheduled");
        toast.success("Viewing interest sent", { description: "The seller can propose available times from their dashboard." });
      } else if (result.error === "Unauthenticated") {
        setMessageError("Sign in to schedule a viewing for this property.");
      } else {
        setMessageError(result.error);
        toast.error(result.error);
      }
    } catch {
      setMessageError("An unexpected error occurred. Please try again.");
    } finally {
      setIsRequestingViewing(false);
    }
  }

  function handleDetailScroll(event: React.UIEvent<HTMLDivElement>) {
    const nextHasScrolled = event.currentTarget.scrollTop > 8;
    setHasScrolled((current) => (current === nextHasScrolled ? current : nextHasScrolled));
    onScroll?.(event);
  }

  return (
    <m.div
      className="flex h-full flex-col bg-panel text-ink"
      layout
      layoutId={`listing-${listing.id}`}
      data-slot="listing-detail-motion"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {shareStatus}
      </p>
      {manualCopyUrl ? <ManualCopyPopover url={manualCopyUrl} onClose={closeManualCopy} /> : null}

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
        <div className="absolute right-[6.375rem] top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="mobile-fab transition-[transform,background-color,color] duration-[var(--motion-fast)] active:scale-95 motion-reduce:transform-none"
            aria-label="Share listing"
            aria-busy={isSharing}
          >
            <Share2 className="size-[1.125rem] text-ink" />
          </button>
          <button
            type="button"
            onClick={handleFavoriteToggle}
            className={cn(
              "mobile-fab group transition-[transform,background-color,color] duration-200 hover:scale-105 active:scale-90 motion-reduce:transform-none motion-reduce:transition-none",
              favorited && "!bg-forest text-primary-foreground",
            )}
            aria-label={favorited ? "Remove from saved" : "Save listing"}
          >
            <Heart className={cn("size-[1.125rem] transition-transform duration-200 group-active:scale-75 motion-reduce:transition-none", favorited ? "fill-current" : "text-ink")} />
          </button>
        </div>
      </div>

      <div
        data-slot="listing-detail-scroll-region"
        data-scrolled={hasScrolled ? "true" : "false"}
        onScroll={handleDetailScroll}
        className={cn(
          "scroll-contained min-h-0 flex-1 overflow-y-auto scrollbar-hide",
          hasScrolled && "[-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_1.75rem,black_100%)] [mask-image:linear-gradient(to_bottom,transparent_0,black_1.75rem,black_100%)]",
        )}
      >
        {/* Header scrolls with the listing and fades at the top edge once content moves. */}
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
          {listing.listing_reviewed_at ? <StatusBadge tone="info">Listing reviewed {formatDate(listing.listing_reviewed_at)}</StatusBadge> : null}
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
        <m.h1 layoutId={`listing-${listing.id}-title`} className="mt-3 line-clamp-2 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
          {listing.title}
        </m.h1>

        {/* Address */}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0 text-clay" />
          <m.span layoutId={`listing-${listing.id}-location`} className="truncate">{listing.address}</m.span>
        </p>

        {/* Price — secondary focal point — with the save action aligned to it
            (desktop only; mobile uses the floating heart on the image hero). */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <m.p layoutId={`listing-${listing.id}-price`} className="text-[1.75rem] font-bold tracking-tight text-ink sm:text-3xl">
            {formatPrice(displayPrice)}
            {!isSale ? <span className="ml-1.5 text-sm font-medium text-muted-foreground">/month</span> : null}
          </m.p>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={handleShare}
              disabled={isSharing}
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-ink shadow-[var(--elevation-1)] transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
              aria-label="Share listing"
              aria-busy={isSharing}
            >
              <Share2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleFavoriteToggle}
              className={cn(
                "group flex size-10 shrink-0 items-center justify-center rounded-md border shadow-[var(--elevation-1)] transition-[transform,background-color,color] duration-200 hover:scale-105 active:scale-90 motion-reduce:transform-none motion-reduce:transition-none",
                favorited
                  ? "border-forest bg-forest text-primary-foreground"
                  : "border-border bg-panel text-ink hover:border-forest hover:text-forest",
              )}
              aria-label={favorited ? "Remove from saved" : "Save listing"}
            >
              <Heart className={cn("size-4 transition-transform duration-200 group-active:scale-75 motion-reduce:transition-none", favorited && "fill-current")} />
            </button>
          </div>
        </div>
        <LandlordTrustSignals summary={listing.landlordTrust} className="mt-3" />
        </div>

        <div className={cn(compact ? "space-y-4 p-4" : "space-y-5 p-4 sm:space-y-6 sm:p-5")}>
        {/* Desktop: image carousel inside scroll */}
        <div className="hidden sm:block">
          <ImageCarousel images={listing.images} title={listing.title} />
        </div>

        {isSale ? <BondCalculatorCard listing={listing} compact={compact} /> : <TrueMonthlyCostCard listing={listing} compact={compact} />}

        {isSale ? (
          <PurchaseProgressTimeline
            currentStage={currentPurchaseStage}
            completedStages={completedPurchaseStages}
            compact={compact}
          />
        ) : null}

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

        <section className="rounded-xl border border-border bg-surface-panel p-4 shadow-[var(--elevation-1)] sm:rounded-lg">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
              <MapPin className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Location and neighbourhood</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{listing.address}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Explore nearby essentials and travel context on the map beside this property.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
          <h2 className="text-sm font-semibold text-ink">{isSale ? "Property details" : "Lease and utilities"}</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{isSale ? "Type" : "Lease"}</span>
              <span className="text-right font-medium text-ink">
                {isSale
                  ? propertyTypeLabels[listing.property_type as keyof typeof propertyTypeLabels] ?? listing.property_type ?? "Property"
                  : leaseDurationLabels[listing.lease_duration as keyof typeof leaseDurationLabels] ?? listing.lease_duration}
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
                {isSale ? "Listed" : "Available"}
              </span>
              <span className="text-right font-medium text-ink">{formatDate(isSale ? listing.created_at : listing.availability_date)}</span>
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
      </div>

      <div
        className={cn("border-t border-border bg-panel", compact ? "p-3" : "p-4")}
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
        <div
          data-slot="listing-detail-actions"
          className={cn(
            compact
              ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
              : "flex items-stretch gap-3",
          )}
        >
          <Button
            onClick={handleMessage}
            disabled={isMessaging}
            aria-label={initialIntent === "message" ? "Continue message" : isSale ? "Contact seller" : "Message the landlord"}
            className={cn(
              "shrink-0 border-border bg-panel text-ink hover:bg-warm-surface disabled:opacity-50",
              compact ? "h-9 rounded-md px-3 text-sm" : "h-12 rounded-xl px-5 sm:h-11 sm:rounded-md",
            )}
            variant="outline"
          >
            {isMessaging ? <PendingGlyph label="Opening conversation" className={compact ? "mr-1" : "sm:mr-1.5"} /> : <MessageSquare className={cn("size-4", compact ? "mr-1" : "sm:mr-1.5")} />}
            <span className="hidden whitespace-nowrap sm:inline">
              {compact
                ? initialIntent === "message" ? "Continue" : isSale ? "Contact" : "Message"
                : initialIntent === "message" ? "Continue message" : isSale ? "Contact Seller" : "Message"}
            </span>
          </Button>
          {isSale ? (
            <Button
              onClick={handleScheduleViewing}
              disabled={isRequestingViewing}
              className={cn(
                "min-w-0 flex-1 bg-forest font-semibold text-primary-foreground hover:bg-forest/90 disabled:opacity-50",
                compact ? "h-9 rounded-md px-3 text-sm" : "h-12 rounded-xl text-base sm:h-11 sm:rounded-md",
              )}
            >
              {isRequestingViewing ? <PendingGlyph label="Scheduling viewing" className={compact ? "mr-1" : "sm:mr-1.5"} /> : <CalendarDays className={cn("size-4", compact ? "mr-1" : "sm:mr-1.5")} />}
              <span className="whitespace-nowrap">{compact ? "Schedule" : "Schedule Viewing"}</span>
            </Button>
          ) : (
            <ApplicationModal
              listingId={listing.id}
              initialOpen={initialIntent === "apply"}
              trigger={
                <Button className={cn(
                  "min-w-0 flex-1 bg-forest font-semibold text-primary-foreground hover:bg-forest/90",
                  compact ? "h-9 rounded-md px-3 text-sm" : "h-12 rounded-xl text-base sm:h-11 sm:rounded-md",
                )}>
                  Apply now
                </Button>
              }
            />
          )}
          {compact ? (
            <ReportPanel
              listingId={listing.id}
              label="Report"
              className="min-w-0 shrink-0 open:col-span-3 open:col-start-1 open:row-start-2 [&>summary]:min-h-9 [&>summary]:whitespace-nowrap [&>summary]:px-2.5 [&>summary]:text-xs"
            />
          ) : null}
        </div>
        {!compact ? <div className="mt-3"><ReportPanel listingId={listing.id} label="Report this listing" /></div> : null}
      </div>
    </m.div>
  );
}
