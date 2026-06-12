"use client";

// MobileDiscoveryShell — mobile-only (<1024px) chrome composer for the
// Mobile_Map_Discovery feature.
//
// See .kiro/specs/mobile-map-discovery/design.md (MobileDiscoveryShell) and
// requirements.md (Req 8.1, 8.2, 8.3, 9.1, 10.1).
//
// This shell does NOT render the Interactive_Map. The map stays mounted in
// DiscoveryPage at `absolute inset-0` behind everything; the shell only layers
// the mobile chrome on top of it. It composes, in DOM (= visual = tab) order:
//   App_Bar (fixed top)
//   -> SearchRegion (fixed, just below the app bar)
//   -> [optional `children` overlay slot, e.g. a filter panel]
//   -> [map is behind, not part of this shell]
//   -> BottomSheet (fixed/anchored, hosts the ListingCarousel + SortLabel)
//   -> BottomNavigationBar (anchored bottom)
//
// Each child component anchors itself (fixed/absolute); the shell adds a
// fixed/positioned wrapper only for the SearchRegion so it sits directly below
// the App_Bar. The wrapper is `pointer-events-none` so the map remains
// interactive around the controls, while the form re-enables pointer events.

import { cn } from "@/lib/utils";

import type { ListingCardModel, NavKey } from "../lib/types";
import { AppBar } from "./app-bar";
import { BottomNavigationBar } from "./bottom-navigation-bar";
import { BottomSheet } from "./bottom-sheet";
import { ListingCarousel } from "./listing-carousel";
import { ListingGrid } from "./listing-grid";
import { SearchRegion } from "./search-region";
import { ViewToggle } from "./view-toggle";

export type MobileDiscoveryShellProps = {
  // App_Bar (Req 1)
  /** Invoked when the Back_Button is activated. */
  onBack: () => void;
  /** Screen_Title text; defaults to the AppBar's own default ("Listings Near You"). */
  screenTitle?: string;

  // Search region (Req 2) — reuses existing DiscoveryPage search state
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onClearSearch?: () => void;
  onToggleFilters: () => void;
  onLocate: () => void;
  searchInputRef?: React.Ref<HTMLInputElement>;
  filtersActive?: boolean;

  // Map/Grid view toggle — mirrors the desktop sub-app-bar toggle.
  /** True when the Grid_View is active; false for the Map view. */
  isGridView: boolean;
  /** Invoked with the requested view when the ViewToggle is activated. */
  onToggleView: (isGridView: boolean) => void;

  // Bottom_Sheet + Listing_Carousel (Req 4, 5, 6)
  cards: ListingCardModel[];
  selectedListingId?: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectCard: (id: string) => void;
  onSeeAll: () => void;
  /**
   * Optional rich empty-state node (e.g. the area-alert capture form) shown in
   * the carousel/grid when a successful load returns no listings.
   */
  emptyState?: React.ReactNode;

  // Bottom_Navigation_Bar (Req 7)
  activeNav?: NavKey;
  onNavigate?: (key: NavKey) => void;

  /**
   * Optional overlay slot rendered under the App_Bar (e.g. a filter panel).
   * Placed after the SearchRegion in DOM order so tab order stays correct.
   */
  children?: React.ReactNode;
};

/**
 * MobileDiscoveryShell — `lg:hidden` flex column that composes the mobile chrome
 * over the existing full-bleed map (Req 8.1, 8.2, 10.1).
 *
 * The container itself is `pointer-events-none` so the map behind it keeps
 * receiving pointer input; every interactive child re-enables pointer events on
 * its own surface.
 */
export function MobileDiscoveryShell({
  onBack,
  screenTitle,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  onToggleFilters,
  onLocate,
  searchInputRef,
  filtersActive,
  isGridView,
  onToggleView,
  cards,
  selectedListingId,
  isLoading,
  error,
  onRetry,
  onSelectCard,
  onSeeAll,
  emptyState,
  activeNav,
  onNavigate,
  children,
}: MobileDiscoveryShellProps) {
  return (
    <div className={cn("pointer-events-none flex flex-col lg:hidden")}>
      {/* App_Bar — renders itself fixed at the top (Req 1.1). */}
      <AppBar onBack={onBack} screenTitle={screenTitle} />

      {/* SearchRegion & ViewToggle — fixed wrapper positioned at the top of the screen.
          The wrapper stays `pointer-events-none` so the map shows through the gaps;
          the children re-enable pointer events. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-[var(--z-chrome)]"
        style={{ top: "calc(var(--mobile-safe-top) + 0.5rem)" }}
      >
        <div className="pointer-events-auto mx-auto flex w-full max-w-[440px] items-center gap-2 px-4 py-2">
          <SearchRegion
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onSearchSubmit={onSearchSubmit}
            onClearSearch={onClearSearch}
            onToggleFilters={onToggleFilters}
            onLocate={onLocate}
            searchInputRef={searchInputRef}
            filtersActive={filtersActive}
          />
          <ViewToggle isGridView={isGridView} onChange={onToggleView} className="shrink-0" />
        </div>
      </div>

      {/* Optional overlay slot (e.g. filter panel) rendered under the App_Bar. */}
      {children}

      {isGridView ? (
        /* Grid_View — full-screen vertical list of listing cards, covering the
           map (Map/Grid parity with desktop). */
        <ListingGrid
          cards={cards}
          selectedListingId={selectedListingId}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          onSelectCard={onSelectCard}
          emptyState={emptyState}
        />
      ) : (
        /* Bottom_Sheet — anchors itself fixed above the Bottom_Navigation_Bar and
            hosts the Listing_Carousel (which also renders the Sort_Label). */
        <BottomSheet onSeeAll={onSeeAll}>
          <ListingCarousel
            cards={cards}
            selectedListingId={selectedListingId}
            isLoading={isLoading}
            error={error}
            onRetry={onRetry}
            onSelectCard={onSelectCard}
            emptyState={emptyState}
          />
        </BottomSheet>
      )}

      {/* Bottom_Navigation_Bar — anchors itself to the bottom edge (Req 7.1). */}
      <BottomNavigationBar activeNav={activeNav} onNavigate={onNavigate} />
    </div>
  );
}
