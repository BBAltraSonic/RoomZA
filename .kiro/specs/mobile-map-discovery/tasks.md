# Implementation Plan: Mobile_Map_Discovery

## Overview

This plan converts the Mobile_Map_Discovery design into incremental, test-driven coding tasks in TypeScript/React (the existing Next.js codebase). It extracts pure logic into `src/features/map-discovery/lib/` (unit- and property-testable today under Vitest `node` env + fast-check ^4.8.0), then builds the new mobile presentation components under `src/features/map-discovery/mobile/`, and finally wires everything into the existing `DiscoveryPage` client component while reusing the bbox-driven `/api/listings` fetch, Google Maps (`@vis.gl/react-google-maps`) `MapView`, `FilterBar`, `PropertyCard`, `EmptyStateCapture`, and `DiscoverySpotlight`.

Testing split (from the design's Testing Strategy):
- Pure logic → fast-check property tests (`*.test.ts`, `node` env, ≥100 runs).
- Component/DOM, layout, routing, timing, and a11y behavior → Playwright (jsdom/@testing-library are NOT configured, so DOM-asserting unit tests are out of scope here).

the bottomnav on desktop  over the map
## Tasks

- [x] 1. Establish mobile feature scaffolding and shared types
  - Create `src/features/map-discovery/lib/` and `src/features/map-discovery/mobile/` directories
  - Add a `types.ts` in `lib/` defining `GeoPoint`, `ListingCardModel` (with `rating: number | null`, `reviewCount: number | null`, `distanceKm: number | null`), and `NavKey` (`"home" | "discovery" | "list" | "saved" | "profile"`)
  - Define `MAX_MARKERS = 100`, `SHEET_MIN_RATIO = 0.25`, `SHEET_MAX_RATIO = 0.90` constants in `lib/constants.ts`
  - _Requirements: 3.2, 4.4, 4.5_

- [x] 2. Implement marker capping pure function
  - [x] 2.1 Implement `capListings` in `lib/cap.ts`
    - Return the first `min(input.length, MAX_MARKERS)` elements in input order; empty input yields empty output
    - _Requirements: 3.2, 3.7_

  - [ ]* 2.2 Write property test for `capListings`
    - **Property 1: Marker capping preserves a bounded prefix**
    - **Validates: Requirements 3.2, 3.7**
    - fast-check arbitrary: arrays of listing-like objects of length 0..300; `numRuns: 100`
    - Tag: `// Feature: mobile-map-discovery, Property 1`

- [x] 3. Implement haversine distance and "Most Nearest" sort
  - [x] 3.1 Implement `haversineKm(a, b)` in `lib/distance.ts`
    - Great-circle distance in km; symmetric; identity (same point) = 0
    - _Requirements: 5.3, 6.3_

  - [x] 3.2 Implement `mostNearestSort(cards)` in `lib/sort.ts`
    - Ascending `distanceKm`; stable for equal distances; `null` distances placed after all determinable distances
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 3.3 Write property test for `mostNearestSort`
    - **Property 5: "Most Nearest" ordering is correct, stable, and null-last**
    - **Validates: Requirements 6.3, 6.4, 6.5**
    - fast-check arbitrary: card arrays with `distanceKm: number | null`, including duplicate distances; `numRuns: 100`
    - Tag: `// Feature: mobile-map-discovery, Property 5`

- [x] 4. Implement bottom sheet clamp/snap math
  - [x] 4.1 Implement `clampSheetHeight`, `snapSheetHeight`, `snapToHeight` in `lib/sheet.ts`
    - `clampSheetHeight(candidate, vh)` → value within `[0.25*vh, 0.90*vh]`, clamping below/above bounds, passing through in-range values
    - `snapSheetHeight(currentHeight, vh)` → `"expanded"` at/above the 25%/90% midpoint, else `"collapsed"`
    - `snapToHeight(snap, vh)` → concrete bound height for a snap state
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [ ]* 4.2 Write property test for `clampSheetHeight`
    - **Property 3: Sheet height clamp stays within bounds**
    - **Validates: Requirements 4.4, 4.5, 4.6**
    - fast-check arbitrary: arbitrary candidate (incl. negative/huge) + `vh > 0`; `numRuns: 100`
    - Tag: `// Feature: mobile-map-discovery, Property 3`

  - [ ]* 4.3 Write property test for `snapSheetHeight`
    - **Property 4: Sheet release snaps to the nearer bound**
    - **Validates: Requirements 4.7**
    - Assert resolved snap always maps to exactly one of the two bound heights via `snapToHeight`; `numRuns: 100`
    - Tag: `// Feature: mobile-map-discovery, Property 4`

- [x] 5. Implement marker↔card index mapping
  - [x] 5.1 Implement `markerToCardIndex(cards, id)` in `lib/marker-sync.ts`
    - Return index `idx` where `cards[idx].id === id`, or `-1` when absent
    - _Requirements: 3.4_

  - [ ]* 5.2 Write property test for `markerToCardIndex`
    - **Property 2: Marker-to-card index mapping is consistent**
    - **Validates: Requirements 3.4**
    - fast-check arbitrary: sorted card arrays + ids drawn from in/out of the id set; `numRuns: 100`
    - Tag: `// Feature: mobile-map-discovery, Property 2`

- [x] 6. Implement bottom navigation active-state resolver
  - [x] 6.1 Implement `resolveActiveNav` in `lib/nav.ts`
    - Resolve nav state from an activated `NavKey` over {home, discovery, list, saved, profile}; default active = `discovery` before any activation; exactly one active
    - Include the default route mapping with a confirm-during-implementation note: Home→`/`, Discovery→`/` (active), Saved→`/saved`, Profile→`/profile`, List→placeholder/TBD
    - _Requirements: 7.2, 7.3, 7.5, 7.6_

  - [ ]* 6.2 Write property test for `resolveActiveNav`
    - **Property 6: Bottom navigation has exactly one active button**
    - **Validates: Requirements 7.5, 7.6**
    - fast-check arbitrary: nav key from the 5-element set + activation sequences; assert exactly one active matching the activated key; `numRuns: 100`
    - Tag: `// Feature: mobile-map-discovery, Property 6`

- [x] 7. Implement listing card formatters
  - [x] 7.1 Implement `formatRating`, `formatDistance`, `formatPrice` in `lib/format.ts`
    - `formatRating(rating)` → one decimal place, valid range `[0.0, 5.0]`; out-of-range rejected/clamped
    - `formatDistance(km)` → one decimal place plus unit, valid range `[0.0, 999.9]`; out-of-range rejected/clamped
    - `formatPrice(price)` → `R` currency indication for `price > 0`
    - _Requirements: 5.2, 5.3_

  - [ ]* 7.2 Write property test for the formatters
    - **Property 7: Listing card formatters respect precision and ranges**
    - **Validates: Requirements 5.2, 5.3**
    - fast-check arbitrary: rating 0..5, distance 0..999.9, price >0, plus out-of-range values; `numRuns: 100`
    - Tag: `// Feature: mobile-map-discovery, Property 7`

- [x] 8. Checkpoint - pure logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement App_Bar and Search region components
  - [x] 9.1 Implement `AppBar` in `mobile/app-bar.tsx`
    - Fixed top bar; centered, truncating Screen_Title "Listings Near You" using a 3-column grid layout
    - Back_Button ≥44×44, `aria-label="Go back"`, `focus-visible:ring-2 focus-visible:ring-forest`, native `<button>`
    - Back behavior: `router.back()` when `window.history.length > 1`, else `router.push('/')`
    - Use only brand tokens (`text-ink`) for the Screen_Title — no literal colors
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 10.5_

  - [x] 9.2 Implement `SearchRegion` in `mobile/search-region.tsx`
    - Render immediately below App_Bar with no interactive control between them; reuse existing `searchQuery` state and `<form role="search">`
    - Placeholder names both inputs, e.g. "Search by listing name or location"; `maxLength=200`; keyboard-reachable focus ring
    - Filter_Button and Locate_Button as circular ≥44×44 icon buttons to the right, with `aria-label` "Filter listings" / "Use my location"
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.8, 8.3_

- [x] 10. Implement listing marker component
  - [x] 10.1 Implement `ListingMarker` in `mobile/listing-marker.tsx`
    - Upgrade existing `.roomza-price-pin` `<AdvancedMarker>` content: rounded `next/image` thumbnail + forest pin badge beneath (`bg-forest`, no literal colors)
    - Selected/active visual distinction (reuse `roomza-price-pin-selected` treatment); placeholder swap on thumbnail error with a 5s fallback timer
    - _Requirements: 3.3, 3.5, 3.6, 10.5_

- [x] 11. Implement listing card and carousel
  - [x] 11.1 Implement `ListingCard` in `mobile/listing-card.tsx`
    - Thin wrapper composing `<PropertyCard compact>` plus a rating+distance strip
    - Render photo, title, price (`formatPrice`), distance (`formatDistance`), beds/baths; render rating+reviews only when `rating`/`reviewCount` are non-null (hide strip when absent)
    - Activating the card opens detail view (reuse existing `handleViewDetail(id)`); photo failure → `PropertyCard` `Building2` placeholder
    - Use `text-ink` for card text (no literal colors)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 10.5_

  - [x] 11.2 Implement `SortLabel` in `mobile/sort-label.tsx`
    - Exact text "Closest"; rendered only when ≥1 card exists
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 11.3 Implement `ListingCarousel` in `mobile/listing-carousel.tsx`
    - Horizontal snap-scroll row of `ListingCard`s; card refs for `scrollIntoView({ behavior: 'smooth', inline: 'center' })`
    - Loading skeletons; empty-state via `EmptyStateCapture`; error indication + retry control that retains previously shown cards; render `SortLabel` below carousel when cards exist
    - On keyboard marker activation, move focus to the corresponding card after scroll
    - _Requirements: 5.1, 5.6, 5.7, 5.8, 5.9, 6.1, 6.6, 9.5_

- [x] 12. Implement bottom sheet and bottom navigation components
  > **Note (post-implementation):** The product moved to a chrome-light, full-map mobile experience. `SheetHeader`, `BottomSheet`, and `BottomNavigationBar` (and the `lib/nav` helper) were subsequently **removed**; the live page uses an inline heroSlot sheet and has no bottom nav. `lib/sheet.ts` clamp/snap math is kept (still property-tested). See Requirement 7 (Descoped).
  - [x] 12.1 Implement `SheetHeader` in `mobile/sheet-header.tsx` _(removed)_
    - Sheet_Title "Nearby Listings" + See_All_Link with `aria-label="See all nearby listings"`
    - _Requirements: 4.2, 4.10_

  - [x] 12.2 Implement `BottomSheet` in `mobile/bottom-sheet.tsx` _(removed)_
    - Draggable panel overlaying lower map; reuse existing `pointermove` drag, applying `clampSheetHeight` during drag (`transition-none`) and `snapSheetHeight`/`snapToHeight` on release (≤300ms transition)
    - Enforce `effectiveMin = max(0.25*vh, headerHeight + oneCardRowHeight)` so Sheet_Header + one card row stay visible at collapsed height
    - See_All_Link → expand to max snap and switch carousel to in-place vertical full list (no new route; default per Data Gap 3)
    - Host `SheetHeader`, `ListingCarousel`, `SortLabel`
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 10.4_

  - [x] 12.3 Implement `BottomNavigationBar` in `mobile/bottom-navigation-bar.tsx` _(removed)_
    - Five Nav_Buttons in order Home, Discovery, List, Saved, Profile; driven by `resolveActiveNav`; Discovery active by default
    - Active button uses `text-forest`/`bg-forest` token AND a non-color indicator (persistent label + filled/thicker icon)
    - Accessible name per destination; native `<a>`/`<button>` roles; focus ring contrast ≥3:1; navigation error indication retaining previous active on >1s failure/timeout
    - Default route mapping with confirm-during-implementation note: Home→`/`, Discovery→`/`, Saved→`/saved`, Profile→`/profile`, List→placeholder/TBD
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 9.4, 9.6, 10.5_

- [x] 13. Checkpoint - components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Assemble the mobile shell
  - [x] 14.1 Implement `MobileDiscoveryShell` in `mobile/mobile-discovery-shell.tsx`
    - `lg:hidden` flex column owning vertical layout, safe-area insets (`--mobile-safe-top`, `--mobile-bottom-nav-h`, `--mobile-safe-bottom`), no horizontal overflow
    - Compose `AppBar`, `SearchRegion`, and the listings carousel/sort over the existing full-bleed `MapView` (the carousel/sort live in the page's inline heroSlot sheet; `BottomSheet` and `BottomNavigationBar` were removed under the chrome-light direction)
    - DOM order = visual order (App_Bar → Search region → map → sheet → bottom nav) for correct tab order; no keyboard trap
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 10.1_

- [x] 15. Wire the shell into DiscoveryPage and reused data flow
  - [x] 15.1 Build the card model pipeline in `discovery-page.tsx`
    - Resolve distance origin: visitor geolocation when available, else map center, else `distanceKm = null` (Data Gap 2 default)
    - Map capped listings (`capListings`) → `ListingCardModel` with `haversineKm(origin, listing)`; model `rating`/`reviewCount` as nullable and hidden when absent (Data Gap 1 default); apply `mostNearestSort`
    - Derive both `MapView` markers and carousel cards from the same sorted+capped array so indices align
    - _Requirements: 3.2, 5.2, 6.3, 6.5_

  - [x] 15.2 Replace inline mobile chrome with `MobileDiscoveryShell` and wire callbacks
    - Render `MobileDiscoveryShell` below 1024px (`lg:hidden`); keep desktop `<aside>` unchanged; keep `DiscoverySpotlight` rendering on top within the mobile container
    - Wire `onBack`, search state/submit, `onToggleFilters` (reuse `setShowFilters` → `FilterBar`), `onSelectCard`, `onSeeAll`, and `activeNav`
    - Change sheet bounds to 25%/90% (replace `PEEK_RATIO=0.46`/`EXPANDED_RATIO=0.72`)
    - _Requirements: 2.4, 4.4, 4.5, 8.4, 10.1, 10.2, 10.4_

  - [x] 15.3 Wire Locate_Button geolocation and map recenter
    - On Locate, call `navigator.geolocation.getCurrentPosition` with a 10s timeout (`Promise.race`); on success recenter map (`panTo` + zoom) within 2s via an `onRequestRecenter(coords)` callback forwarded to `MapView`
    - On denial/timeout, show non-blocking "Current location unavailable" message and leave map center/zoom unchanged
    - _Requirements: 2.5, 2.6_

  - [x] 15.4 Wire marker↔carousel selection synchronization
    - On marker activation, `setSelectedListingId(id)`; carousel computes `markerToCardIndex(sortedCards, id)` and scrolls to the card within 300ms; selected marker shows visual distinction
    - On keyboard marker activation, move focus to the corresponding card
    - _Requirements: 3.4, 3.5, 9.5_

  - [x] 15.5 Add fetch resiliency for carousel error/retry
    - Add a 30s timeout to the existing AbortController fetch flow; on error/timeout set an error flag WITHOUT clearing `visibleListings` (retain previous cards) and surface retry; retry re-issues bbox fetch with a new AbortController and shows loading
    - _Requirements: 5.8, 5.9_

  - [x] 15.6 Wire responsive boundary and discovery-pop error handling
    - Use existing `lg:` CSS gating plus a `matchMedia('(min-width: 1024px)')` listener so JS-side state re-evaluates within the 500ms budget on resize across the 1024px boundary; render at `/` with no redirect
    - Render an error indication for Value_Proposition / Primary_Search_CTA load failure while staying at `/`
    - _Requirements: 8.5, 8.6, 10.1, 10.3_

- [x] 16. Enforce brand-token-only usage on themed elements
  - [x] 16.1 Add a static grep/lint check for brand tokens
    - Assert Screen_Title, Active_Nav_Button, and Listing_Marker pin badge use only token-backed classes (`text-ink`, `text-forest`, `bg-forest`) with no hex/rgb literals in the new component files
    - _Requirements: 10.5_

- [x] 17. Final checkpoint - ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP; they are the fast-check property tests for the extracted pure logic.
- Each task references specific granular requirement clauses for traceability.
- The 7 correctness properties (P1–P7) each map to a dedicated property-test sub-task placed next to the implementation it validates, catching errors early.
- Layout, routing, timing, and a11y acceptance criteria are verified via Playwright (per the design's Testing Strategy); jsdom/@testing-library are not configured, so DOM-asserting unit tests are intentionally out of scope here.
- Open Questions / Data Gaps are honored with sensible defaults: nullable+hidden rating/reviewCount (Gap 1), geolocation→map-center→null distance origin (Gap 2), in-place See_All expand (Gap 3), and a default Bottom_Nav route mapping with a confirm-during-implementation note for the ambiguous "List" destination (Gap 4).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "4.3", "5.2", "6.2", "7.2"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["9.1", "9.2", "10.1", "11.1", "11.2", "12.1", "12.3"] },
    { "id": 5, "tasks": ["11.3", "12.2"] },
    { "id": 6, "tasks": ["14.1"] },
    { "id": 7, "tasks": ["15.1"] },
    { "id": 8, "tasks": ["15.2"] },
    { "id": 9, "tasks": ["15.3", "15.4", "15.5", "15.6"] },
    { "id": 10, "tasks": ["16.1"] }
  ]
}
```
