"use client";
import Link from "next/link";
import { useSpecialDetails } from "./special-details";
import { useSpecialDetail } from "./use-special-detail";
import { CalendarDays, Clock3, Compass, Heart, Navigation, Share2, ShoppingBag, Store, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BlurImage } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";
import { DiscoveryCard, DiscoveryCardMapAction, type DiscoveryCardSignal } from "@/components/premium/discovery-card";
import { SaveIconButton } from "@/components/premium/property-card";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import { DirectContactSheet } from "@/features/guest-contact/direct-contact-sheet";
import type { PublicContact } from "@/features/guest-contact/schema";
import { specialPriceCents } from "@/features/map-discovery/lib/pin-content";
import { discountPercent, formatDealPrice } from "./deal-schema";
import { specialTiming, useDiscoveryNow } from "./discovery-clock";
import { useSavedSpecial, type SpecialCategory } from "./saved-specials-client";
import styles from "./special-card.module.css";
import { PhotoPlaceholder } from "./photo-placeholder";
const format = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
export type SpecialCardData = { id: string; category: SpecialCategory; title: string; identity: string; address: string; href: string; description: string; startsAt: string; endsAt: string; priceCents?: number; originalPriceCents?: number; bannerUrl?: string; savedCount?: number; upcoming?: boolean;
  /** A shopping offer's one-line benefit, where businesses often type the price. */
  benefit?: string };
export type SpecialCardProps = { selected?: boolean; onShowOnMap?: () => void; expanded?: boolean; onClose?: () => void; onOpenDetails?: () => void; distance?: string };

const CATEGORY_LABELS: Record<SpecialCategory, string> = { shopping: "Shopping", tourism: "Places", event: "Events" };
const CATEGORY_ICONS: Record<SpecialCategory, ReactNode> = {
  shopping: <ShoppingBag className="size-10" aria-hidden="true" />,
  tourism: <Compass className="size-10" aria-hidden="true" />,
  event: <CalendarDays className="size-10" aria-hidden="true" />,
};

export function SpecialCard({ special, selected, onShowOnMap, expanded, onClose, onOpenDetails, distance, contact }: SpecialCardProps & { special: SpecialCardData; contact?: PublicContact | null }) {
  const details = useSpecialDetails();
  const openDetails = onOpenDetails ?? (details ? () => details.open(special.id) : undefined);
  const onNavigate = openDetails ? (event: { preventDefault: () => void }) => { event.preventDefault(); openDetails(); } : undefined;
  const now = useDiscoveryNow(), timing = specialTiming(special.startsAt, special.endsAt, now ?? Date.parse(special.upcoming ? special.startsAt : special.endsAt) - 1);
  const save = useSavedSpecial({ category: special.category, id: special.id }, special.savedCount ?? 0), discount = discountPercent(special.priceCents, special.originalPriceCents);
  const category = CATEGORY_LABELS[special.category];
  const schedule = special.category === "shopping" ? "Ends " + format.format(new Date(special.endsAt)) + " SAST" : format.format(new Date(special.startsAt)) + " SAST – " + format.format(new Date(special.endsAt)) + " SAST";
  if (expanded) return <ExpandedSpecialCard {...{ special, selected, onClose, distance, contact, onNavigate, now, timing, save, discount, category, schedule }} />;

  // Like a home's availability, the time left leads the signals; the saving and interest follow.
  const cents = specialPriceCents({ title: special.title, benefit: special.benefit, priceCents: special.priceCents });
  const timingLabel = now === null ? (special.upcoming ? "Upcoming" : "Available now") : timing.label;
  const signals: DiscoveryCardSignal[] = [
    { label: timingLabel, description: schedule, icon: <Clock3 className="size-3 shrink-0" aria-hidden="true" />,
      tone: timing.ended ? "neutral" : now === null ? (special.upcoming ? "info" : "success") : timing.upcoming ? "info" : timing.tone === "later" ? "success" : "warning" },
    ...(discount === null ? [] : [{ label: discount + "% off", description: "Saving on the usual price of " + formatDealPrice(special.originalPriceCents!) + ".", tone: "success" as const }]),
    ...(save.count > 0 ? [{ label: save.count + " saved", description: save.count + (save.count === 1 ? " person has" : " people have") + " saved this.", tone: "neutral" as const }] : []),
  ];
  return <DiscoveryCard
    category={special.category}
    cardId={special.id}
    slotPrefix="special-card"
    presentation="compact"
    title={special.title}
    href={special.href}
    prefetch={false}
    onNavigate={onNavigate}
    onSelect={openDetails}
    location={special.address + (distance ? " · " + distance : "")}
    emphasis={cents === undefined ? undefined : formatDealPrice(cents)}
    emphasisSuffix={discount === null ? undefined : <s>{formatDealPrice(special.originalPriceCents!)}</s>}
    selected={selected}
    media={{
      imageUrls: special.bannerUrl ? [special.bannerUrl] : [],
      imageAlt: special.title,
      placeholder: CATEGORY_ICONS[special.category],
      action: <SaveIconButton saved={save.saved} disabled={save.pending || timing.ended} onClick={() => void save.toggle()} saveLabel="Save Special" removeLabel="Remove Special from saved" savedTitle="Special saved" />,
    }}
    features={<span className="inline-flex min-w-0 items-center gap-1"><Store className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="sr-only">{category}: </span><span className="truncate">{special.identity}</span></span>}
    signals={signals}
    signalsLabel="Special signals"
    metadata={<>
      <span className="sr-only">{schedule}</span>
      {now !== null && !timing.upcoming && !timing.ended ? <div role="progressbar" aria-label="Special time remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timing.progress * 100)} className={styles.progress}><div className={styles[timing.tone]} style={{ width: timing.progress * 100 + "%" }} /></div> : null}
    </>}
    actions={!timing.ended || onShowOnMap ? <>
      {!timing.ended ? <ContactActions contact={contact} title={special.title} compact /> : null}
      {onShowOnMap ? <DiscoveryCardMapAction onClick={onShowOnMap} selected={selected} /> : null}
    </> : undefined}
  />;
}

type ExpandedProps = {
  special: SpecialCardData; selected?: boolean; onClose?: () => void; distance?: string; contact?: PublicContact | null;
  onNavigate?: (event: { preventDefault: () => void }) => void; now: number | null; timing: ReturnType<typeof specialTiming>;
  save: ReturnType<typeof useSavedSpecial>; discount: number | null; category: string; schedule: string;
};

/** The map popup: a photo-led preview whose actions stay outside its scrollable body. */
function ExpandedSpecialCard({ special, selected, onClose, distance, contact, onNavigate, now, timing, save, discount, category, schedule }: ExpandedProps) {
  const [shareMessage, setShareMessage] = useState("");
  const heart = <Heart size={18} aria-hidden="true" className={save.saved ? "fill-current" : ""} />;
  const saveButton = <button type="button" aria-label={save.saved ? "Remove Special from saved" : "Save Special"} aria-pressed={save.saved} disabled={save.pending || timing.ended} onClick={() => void save.toggle()} className={styles.iconButton}>{heart}</button>;
  async function share() {
    const url = new URL(special.href, window.location.origin).href;
    if (navigator.share) {
      try { await navigator.share({ title: special.title, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setShareMessage("Link copied"); }
    catch { setShareMessage("Sharing unavailable. Open the details to copy the link."); }
  }
  return <article data-slot="special-card" data-card-category={special.category} data-card-layout="map" className={cn(styles.card, selected && "border-selection ring-2 ring-selection/25", styles.expanded)}>
    <header className={cn(styles.hero, styles.photoHero)}>
      <Link href={special.href} prefetch={false} onNavigate={onNavigate} aria-label={"View details: " + special.title} className={styles.heroPhoto} data-slot="special-card-media">{special.bannerUrl ? <BlurImage src={special.bannerUrl} alt={special.title} fill sizes="340px" wrapperClassName="size-full" className="object-cover" fallback={<PhotoPlaceholder />} /> : <PhotoPlaceholder />}</Link>
      <div className={styles.heroIdentity}><p className={styles.heroLocation} title={special.address}><span>{category} · {special.address}</span>{distance ? <span> · {distance}</span> : null}</p><p className={styles.heroName} title={special.identity}>{special.identity}</p></div>
      {onClose ? <button type="button" aria-label="Close selected Special" onClick={onClose} className={cn(styles.iconButton, styles.closeButton)}><X size={18} aria-hidden="true" /></button> : null}
    </header>
    <div className={styles.body} data-slot="special-card-body">
      <h2 className={styles.title}><Link href={special.href} prefetch={false} onNavigate={onNavigate} className={styles.titleLink} title={special.title}><span>{special.title}</span></Link></h2>
      <div className={styles.priceRow}>
        {special.priceCents !== undefined ? <span className={styles.price}>{formatDealPrice(special.priceCents)}</span> : null}
        {discount !== null ? <div className={styles.discount}><s>{formatDealPrice(special.originalPriceCents!)}</s><p>{discount}% off</p></div> : null}
        <span className={styles.category}>{category}</span>
      </div>
      <p className={cn(styles.timing, now === null ? styles.identity : styles[timing.tone])}><Clock3 size={15} aria-hidden="true" /><time dateTime={timing.upcoming ? special.startsAt : special.endsAt} title={schedule}>{now === null ? (special.upcoming ? "Upcoming" : "Available now") : timing.label}</time></p>
      <span className="sr-only">{schedule}</span>
      {now !== null && !timing.upcoming ? <div role="progressbar" aria-label="Special time remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timing.progress * 100)} className={styles.progress}><div className={styles[timing.tone]} style={{ width: timing.progress * 100 + "%" }} /></div> : null}
    </div>
    <footer className={styles.footer} data-slot="special-card-actions">
      {!timing.ended ? <div className={styles.actionRow}>
          <SpecialPreviewDirections category={special.category} id={special.id} />
          {saveButton}
          <button type="button" aria-label="Share Special" onClick={() => void share()} className={styles.iconButton}><Share2 size={18} aria-hidden="true" /></button>
      </div> : null}
      {!timing.ended && contact ? <DirectContactSheet contact={contact} title={special.title} name={special.identity} className="mt-2" /> : null}
      <p className={styles.savedCount}>{save.count} {save.count === 1 ? "person" : "people"} saved this</p>
      {shareMessage ? <p role="status" className={styles.shareStatus}>{shareMessage}</p> : null}
    </footer>
  </article>;
}

function SpecialPreviewDirections({ category, id }: { category: SpecialCardData["category"]; id: string }) {
  const controller = useSpecialDetail({ category, id });
  return <div className="min-w-0 flex-1"><button type="button" disabled={controller.checking || controller.acting || !controller.detail?.item} onClick={() => void controller.directions()} className={styles.direction}><Navigation size={16} aria-hidden="true" />{controller.acting ? "Checking…" : "Directions"}</button>{controller.error ? <p role="alert" className="text-xs text-status-error-text">{controller.error}</p> : null}</div>;
}
