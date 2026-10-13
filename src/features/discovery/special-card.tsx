"use client";
import Link from "next/link";
import { useSpecialDetails } from "./special-details";
import { useSpecialDetail } from "./use-special-detail";
import { Clock3, Heart, MapPin, Navigation, Share2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BlurImage } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";
import { discountPercent, formatDealPrice } from "./deal-schema";
import { specialTiming, useDiscoveryNow } from "./discovery-clock";
import { useSavedSpecial, type SpecialCategory } from "./saved-specials-client";
import styles from "./special-card.module.css";
import { PhotoPlaceholder } from "./photo-placeholder";
const format = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
export type SpecialCardData = { id: string; category: SpecialCategory; title: string; identity: string; address: string; href: string; description: string; startsAt: string; endsAt: string; priceCents?: number; originalPriceCents?: number; bannerUrl?: string; savedCount?: number; upcoming?: boolean };
export type SpecialCardProps = { selected?: boolean; onShowOnMap?: () => void; expanded?: boolean; onClose?: () => void; onOpenDetails?: () => void; distance?: string };
export function SpecialCard({ special, selected, onShowOnMap, expanded, onClose, onOpenDetails, distance, contactActions }: SpecialCardProps & { special: SpecialCardData; contactActions?: ReactNode }) {
  const details = useSpecialDetails();
  const openDetails = onOpenDetails ?? (details ? () => details.open(special.id) : undefined);
  const onNavigate = openDetails ? (event: { preventDefault: () => void }) => { event.preventDefault(); openDetails(); } : undefined;
  const now = useDiscoveryNow(), timing = specialTiming(special.startsAt, special.endsAt, now ?? Date.parse(special.upcoming ? special.startsAt : special.endsAt) - 1);
  const save = useSavedSpecial({ category: special.category, id: special.id }, special.savedCount ?? 0), discount = discountPercent(special.priceCents, special.originalPriceCents);
  const [shareMessage, setShareMessage] = useState("");
  const category = special.category === "shopping" ? "Shopping" : special.category === "tourism" ? "Places" : "Events";
  const schedule = special.category === "shopping" ? "Ends " + format.format(new Date(special.endsAt)) + " SAST" : format.format(new Date(special.startsAt)) + " SAST – " + format.format(new Date(special.endsAt)) + " SAST";
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
  return <article data-slot="special-card" data-card-category={special.category} data-card-layout={expanded ? "map" : "result"} className={cn(styles.card, selected && "border-forest ring-2 ring-forest/25", expanded && styles.expanded)}>
    {expanded ? <header className={cn(styles.hero, styles.photoHero)}>
      <Link href={special.href} prefetch={false} onNavigate={onNavigate} aria-label={"View details: " + special.title} className={styles.heroPhoto} data-slot="special-card-media">{special.bannerUrl ? <BlurImage src={special.bannerUrl} alt={special.title} fill sizes="340px" wrapperClassName="size-full" className="object-cover" fallback={<PhotoPlaceholder />} /> : <PhotoPlaceholder />}</Link>
      <div className={styles.heroIdentity}><p className={styles.heroLocation} title={special.address}><span>{category} · {special.address}</span>{distance ? <span> · {distance}</span> : null}</p><p className={styles.heroName} title={special.identity}>{special.identity}</p></div>
      {onClose ? <button type="button" aria-label="Close selected Special" onClick={onClose} className={cn(styles.iconButton, styles.closeButton)}><X size={18} aria-hidden="true" /></button> : null}
    </header> : <header className={styles.identityRow}>
      <span aria-hidden="true" className={styles.initial}>{special.identity.slice(0, 1).toUpperCase()}</span>
      <div className={styles.identityText}><p className={styles.businessName} title={special.identity}>{special.identity}</p><p className={styles.location} title={special.address}><span>{special.address}</span>{distance ? <span> · {distance}</span> : null}</p></div>
      {saveButton}
    </header>}
    {!expanded ? <Link href={special.href} prefetch={false} onNavigate={onNavigate} aria-label={"View details: " + special.title} className={styles.banner} data-slot="special-card-media">{special.bannerUrl ? <BlurImage src={special.bannerUrl} alt={special.title} fill sizes="(min-width: 1024px) 384px, 100vw" wrapperClassName="size-full" className="object-cover" fallback={<PhotoPlaceholder />} /> : <PhotoPlaceholder />}</Link> : null}
    <div className={styles.body} data-slot="special-card-body">
      <h2 className={styles.title}><Link href={special.href} prefetch={false} onNavigate={onNavigate} className={styles.titleLink} title={special.title}><span>{special.title}</span></Link></h2>
      <div className={styles.priceRow}>
        {special.priceCents !== undefined ? <span className={styles.price}>{formatDealPrice(special.priceCents)}</span> : null}
        {discount !== null ? <div className={styles.discount}><s>{formatDealPrice(special.originalPriceCents!)}</s><p>{discount}% off</p></div> : null}
        {!expanded && onShowOnMap ? <button type="button" aria-label="Show on map" title="Show on map" aria-pressed={Boolean(selected)} onClick={onShowOnMap} className={styles.categoryAction}><span className={styles.category}>{category}<MapPin size={12} aria-hidden="true" /></span></button> : <span className={styles.category}>{category}</span>}
      </div>
      <p className={cn(styles.timing, now === null ? styles.identity : styles[timing.tone])}><Clock3 size={15} aria-hidden="true" /><time dateTime={timing.upcoming ? special.startsAt : special.endsAt} title={schedule}>{now === null ? (special.upcoming ? "Upcoming" : "Available now") : timing.label}</time></p>
      <span className="sr-only">{schedule}</span>
      {now !== null && !timing.upcoming ? <div role="progressbar" aria-label="Special time remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timing.progress * 100)} className={styles.progress}><div className={styles[timing.tone]} style={{ width: timing.progress * 100 + "%" }} /></div> : null}
    </div>
    {expanded ? <footer className={styles.footer} data-slot="special-card-actions">
      {!timing.ended ? <div className={styles.actionRow}>
          <SpecialPreviewDirections category={special.category} id={special.id} />
          {saveButton}
          <button type="button" aria-label="Share Special" onClick={() => void share()} className={styles.iconButton}><Share2 size={18} aria-hidden="true" /></button>
      </div> : null}
      <p className={styles.savedCount}>{save.count} {save.count === 1 ? "person" : "people"} saved this</p>
      {!timing.ended && contactActions ? <details className={styles.contacts}><summary>Contact venue</summary>{contactActions}</details> : null}
      {shareMessage ? <p role="status" className={styles.shareStatus}>{shareMessage}</p> : null}
    </footer> : !timing.ended && contactActions ? <div className={styles.resultContacts}>{contactActions}</div> : null}
  </article>;
}

function SpecialPreviewDirections({ category, id }: { category: SpecialCardData["category"]; id: string }) {
  const controller = useSpecialDetail({ category, id });
  return <div className="min-w-0 flex-1"><button type="button" disabled={controller.checking || controller.acting || !controller.detail?.item} onClick={() => void controller.directions()} className={styles.direction}><Navigation size={16} aria-hidden="true" />{controller.acting ? "Checking�" : "Directions"}</button>{controller.error ? <p role="alert" className="text-xs text-status-error-text">{controller.error}</p> : null}</div>;
}
