"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { authPathForRedirect } from "@/lib/redirects";
import { SlidersHorizontal } from "lucide-react";
import { DiscoverySearch } from "./discovery-search-dock";
import { useDiscoveryAccount } from "./navigation-account-context";
import { useBrowserDiscoverySearchParams } from "@/features/discovery/use-discovery-search-params";
import styles from "./pinpoint-header.module.css";
import chrome from "./pinpoint-chrome.module.css";
import { PinpointBrandLink, PinpointChrome, PinpointHeaderActions } from "./pinpoint-chrome";

export type DiscoveryCategory = "specials" | "property" | "services";

export function discoveryCategoryHref(category: DiscoveryCategory, areaId?: string | null, area?: string | null, view: "feed" | "map" = "map") {
  const params = new URLSearchParams();
  if (areaId) params.set("areaId", areaId);
  if (area) params.set("area", area);
  // Keep the legacy argument compatible while generating map-only links.
  if (view !== "map") view = "map";
  params.set("view", view);
  const path = category === "property" ? "/" : category === "specials" ? "/offers" : "/services";
  return `${path}${params.size ? `?${params}` : ""}`;
}

export function DiscoveryCategories({ category, areaId, area, count, propertyHref }: {
  category: DiscoveryCategory; areaId?: string | null; area?: string | null; count?: number; propertyHref?: string; view?: "feed" | "map";
}) {
  const params = useBrowserDiscoverySearchParams();
  function href(item: DiscoveryCategory) {
    const url = new URL(discoveryCategoryHref(item, areaId, area), "https://pinpoint.invalid");
    if (item !== "property") for (const key of ["bbox", "q", "sort", ...(item === "services" ? ["serviceType"] : [])]) {
      if (params.has(key)) url.searchParams.set(key, params.get(key)!);
    }
    return url.pathname + url.search;
  }
  return <nav aria-label="Discovery categories" className={`${chrome.palette} ${styles.categories}`}>
    {(["specials", "property", "services"] as const).map((item) => <Link
      key={item} href={item === "property" && propertyHref ? propertyHref : href(item)}
      prefetch={false} aria-current={category === item ? "page" : undefined} className={styles.category}
    >{item === "specials" ? "Specials" : item === "property" ? "Property" : "Services"}
      {category === item && count !== undefined && count > 0 ? <span className={styles.count}>{count}</span> : null}
    </Link>)}
  </nav>;
}

export function PinpointHeader({ category, areaId, area, count, location, search, toolbar, propertyHref, addHref, addUnavailable, searchHint, searchActive = false }: {
  category: DiscoveryCategory; areaId?: string | null; area?: string | null; count?: number;
  location: ReactNode; search?: ReactNode; view?: "feed" | "map";
  /** Accepted for older callers; discovery always renders the map. */
  onViewChange?: (view: "feed" | "map") => void; toolbar?: ReactNode; propertyHref?: string; addHref?: string; addUnavailable?: string; searchHint?: string; searchActive?: boolean;
}) {
  const { profileMenu, isAuthenticated } = useDiscoveryAccount();
  const [controlsOpen, setControlsOpen] = useState(false);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const addLabel = "Create listing";
  const destination = addHref ?? "/post";
  return <PinpointChrome variant="discovery" className={styles.header} data-slot="pinpoint-header" data-ready={ready} data-controls-open={controlsOpen} data-search-active={searchActive}>
    <div className={chrome.topRow}>
      <PinpointBrandLink tagline />
      <div className={styles.location}>{location}</div>
      {search ? <DiscoverySearch view="map" hint={searchHint}>{search}</DiscoverySearch> : <div className={styles.spacer} />}
      <PinpointHeaderActions profileMenu={profileMenu} add={{ href: isAuthenticated ? destination : authPathForRedirect(destination), label: addLabel, unavailable: addUnavailable }} />
    </div>
    <div className={styles.bottomRow}>
      <DiscoveryCategories category={category} areaId={areaId} area={area} count={count} propertyHref={propertyHref} />
      {toolbar || search ? <><button type="button" className={styles.refine} aria-label={search ? "Show search, sorting and filters" : "Show sorting and filters"} aria-expanded={controlsOpen} onClick={() => setControlsOpen(!controlsOpen)}><SlidersHorizontal size={18} aria-hidden="true" /><span>Refine</span></button><div className={styles.toolbar} data-open={controlsOpen}>{toolbar}</div></> : null}
    </div>
  </PinpointChrome>;
}

export function DiscoverySortPills({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <div className={styles.sorts} aria-label="Sort results">{options.map((option) => <button type="button" key={option}
    className={styles.sort} aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>)}</div>;
}

export function DiscoverySortSelect({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <label className={styles.sortSelect}><span>Sort</span><select aria-label="Sort listings" value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{option === "Closest" ? "Nearest" : option}</option>)}</select></label>;
}
