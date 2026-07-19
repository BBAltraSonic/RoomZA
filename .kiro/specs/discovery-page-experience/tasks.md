# Implementation Plan: Discovery_Page_Experience

## Overview

This is a hardening and verification plan, not a greenfield build. The Discovery_Page_Experience
already exists and is mature (rooted in `src/features/map-discovery/discovery-page.tsx`, its `lib/`,
`hooks/`, and `mobile/` modules, the `/api/listings` and `/api/listings/[id]` route handlers, and
`src/features/listings/api.ts`). The goal here is to raise that existing surface to the design's
ELITE performance and architecture bar by:

- extracting a small number of pure helpers where the design calls for them to be directly testable
  (the bbox 6-decimal formatter, the distance-origin resolver, the marker-order derivation, and the
  POI cache-key builder), touching the orchestrator only to wire the extracted helpers back in;
- adding the 13 property-based tests defined in the design's Testing Strategy using `fast-check` +
  `vitest` (minimum 100 generated cases each, tagged `Feature: discovery-page-experience, Property {n}: {text}`);
- adding the unit, Request_Manager, and API route integration tests defined in the design;
- adding the bundle-size, viewport-payload, and Lighthouse/CWV verification harnesses.

Where behavior already exists and conforms to the design, the task is to **audit and add/confirm
test coverage** rather than rewrite. All code is TypeScript, consistent with the design and the
existing `.test.ts` suites.

Ordering follows the design's test seams: pure `lib/` hardening + property tests first, then the
client Request_Manager and pipeline/state verification, then server route hardening + integration
tests, then rendering/code-split/streaming confirmation, and finally the performance budgets and
CWV verification.

## Tasks

- [x] 1. Establish pure helper seams for direct testability
  - [x] 1.1 Extract the bbox 6-decimal formatter into a pure helper
    - In `src/features/map-discovery/lib/format.ts`, add a pure `formatBboxParam(bounds: ViewportBounds): string` that returns `west,south,east,north` with each coordinate rendered via `toFixed(6)`
    - Refactor `discovery-page.tsx` to build the Viewport_Query `bbox` parameter through this helper instead of inline formatting, so the formatting rule is a single directly-testable function
    - _Requirements: 1.1_

  - [x] 1.2 Extract the distance-origin resolver into a pure helper
    - In `src/features/map-discovery/lib/distance.ts`, add a pure `resolveDistanceOrigin(geo, bounds): GeoPoint | null` that returns the visitor geolocation when present, else the midpoint of the Viewport_Bounds when bounds exist, else null
    - Refactor `discovery-page.tsx` to derive `distanceOrigin` through this helper (keeping the existing 10s geolocation fallback wiring intact)
    - _Requirements: 7.3, 7.4, 7.5_

  - [x] 1.3 Extract the marker-order derivation into a pure helper
    - In `src/features/map-discovery/lib/marker-sync.ts`, add a pure `deriveMarkerListings(cards)` that returns marker records whose ids preserve the exact order of the Card_Pipeline output
    - Refactor `discovery-page.tsx` so `markerListings` is produced by this helper from the same capped+sorted card order the cards use
    - _Requirements: 8.1_

  - [x] 1.4 Expose the POI cache-key builder as a pure export
    - In `src/features/map-discovery/hooks/use-overpass-pois.ts`, extract the in-memory cache key logic into a pure exported `getCacheKey(categoryId, bounds)` that rounds each coordinate to 0.01° (`Math.round(coord * 100) / 100`) and composes `${categoryId}_${north}_${south}_${east}_${west}`
    - Have the hook consume this helper so the key rule is directly testable without invoking the fetch
    - _Requirements: 5.4_

- [x] 2. Property-test and confirm the cap / distance / sort transforms
  - [x] 2.1 Property test for the marker cap (co-located property test for `lib/cap.ts`)
    - Audit `capListings` returns the first `min(length, 200)` items in input order; add the property test with `fast-check` (≥100 runs)
    - **Property 1: Marker cap preserves a bounded in-order prefix** — for any array, output is the first `min(length, 200)` elements in original order and length never exceeds 200
    - Tag: `Feature: discovery-page-experience, Property 1: Marker cap preserves a bounded in-order prefix`
    - _Requirements: 7.1, 8.1_

  - [x] 2.2 Property test for haversine distance (co-located property test for `lib/distance.ts`)
    - **Property 2: Distance is a symmetric, zero-identity metric** — for any points a,b, `haversineKm(a,b) === haversineKm(b,a)` and `haversineKm(a,a) === 0`
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 2: Distance is a symmetric, zero-identity metric`
    - _Requirements: 7.2_

  - [x] 2.3 Property test for "Most Nearest" ordering (co-located property test for `lib/sort.ts`)
    - **Property 3: "Most Nearest" ordering is ascending, stable, and null-last** — `mostNearestSort` yields a permutation with non-decreasing determinable `distanceKm`, stable ties, and all `distanceKm === null` after determinable distances
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 3: "Most Nearest" ordering is ascending, stable, and null-last`
    - _Requirements: 7.6, 6.6, 15.5_

  - [x] 2.4 Property test for price sort monotonicity (co-located property test for `lib/sort.ts`)
    - **Property 5: Price sort ordering is monotonic** — "Price: Low to High" yields non-decreasing `priceValue`; "Price: High to Low" yields non-increasing `priceValue`
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 5: Price sort ordering is monotonic`
    - _Requirements: 6.4, 6.5_

  - [x] 2.5 Property test for latest sort (co-located property test for `lib/sort.ts`)
    - **Property 6: Latest sort orders by descending creation timestamp** — "Latest" orders each timestamp ≥ the next, with missing timestamps treated as epoch and ordered last
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 6: Latest sort orders by descending creation timestamp`
    - _Requirements: 6.7_

- [x] 3. Property-test the distance-origin and marker-layer helpers
  - [x] 3.1 Property test for distance-origin precedence (co-located property test for `lib/distance.ts`)
    - Exercises the `resolveDistanceOrigin` helper from task 1.2
    - **Property 4: Distance origin resolution precedence** — resolved origin equals geolocation when present, else Viewport_Bounds midpoint when bounds exist, else null (and every card `distanceKm` is null in that case)
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 4: Distance origin resolution precedence`
    - _Requirements: 7.3, 7.4, 7.5_

  - [x] 3.2 Property test for marker order matching card order (co-located property test for `lib/marker-sync.ts`)
    - Exercises the `deriveMarkerListings` helper from task 1.3
    - **Property 7: Marker order matches card order** — derived `markerListings` contains the same ids in the same order as the Card_Pipeline output
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 7: Marker order matches card order`
    - _Requirements: 8.1_

  - [x] 3.3 Property test for marker-to-card resolution (co-located property test for `lib/marker-sync.ts`)
    - **Property 8: Marker-to-card resolution** — `markerToCardIndex(cards, id)` returns the first index whose `card.id === id`, else -1
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 8: Marker-to-card resolution`
    - _Requirements: 8.4_

  - [x] 3.4 Property test for clustering threshold (co-located property test for `lib/marker-sync.ts`)
    - **Property 9: Clustering threshold behavior** — `shouldClusterMarkers` is true exactly when count > 200; at/below 200 each listing yields one marker, above 200 output is clusters whose member counts sum to the input count
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 9: Clustering threshold behavior`
    - _Requirements: 8.2, 8.3_

- [x] 4. Property-test the sheet math, POI cache key, and bbox formatting
  - [x] 4.1 Property test for sheet clamp and release (co-located property test for `lib/sheet.ts`)
    - **Property 10: Sheet height clamps within bounds and resolves to a valid snap** — `clampSheetHeight` returns a value within `[collapsed, expanded]`, and `resolveSheetRelease` returns exactly one of the three snaps nearest the velocity-projected release height
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 10: Sheet height clamps within bounds and resolves to a valid snap`
    - _Requirements: 10.4, 13.1_

  - [x] 4.2 Property test for the POI cache key (co-located property test for `hooks/use-overpass-pois.ts`)
    - Exercises the `getCacheKey` helper from task 1.4
    - **Property 12: POI cache key rounds bounds to 0.01° precision** — bounds agreeing to 0.01° for a layer produce identical keys (second lookup hits cache); bounds differing by more than 0.01° produce distinct keys
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 12: POI cache key rounds bounds to 0.01° precision`
    - _Requirements: 5.4_

  - [x] 4.3 Property test for bbox request formatting (co-located property test for `lib/format.ts`)
    - Exercises the `formatBboxParam` helper from task 1.1
    - **Property 13: bbox request formatting uses six decimal places** — for any bounds, the `bbox` param is `west,south,east,north` each formatted to exactly six decimal places
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 13: bbox request formatting uses six decimal places`
    - _Requirements: 1.1_

- [x] 5. Checkpoint - pure transform layer verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Audit and verify the client Request_Manager
  - [x] 6.1 Audit the Request_Manager lifecycle in `discovery-page.tsx`
    - Confirm the two `AbortController` refs (`listingRequestRef`, `detailRequestRef`), the pre-issue supersession `.abort()`, the 2000 ms timeout arming with a `didTimeOut` flag, the silent-vs-surfaced abort branching, and the unmount cleanup effect all conform to the design; refactor only where behavior deviates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 6.2 Test Viewport_Query Request_Manager behavior (`discovery-page.request-manager.test.tsx`)
    - Using mocked `fetch`/`AbortController`: superseding an in-flight query aborts the prior request silently (no error UI); a 2000 ms timeout aborts and surfaces an error while retaining previously displayed listings; unmount aborts in-flight queries
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 12.2_

  - [x] 6.3 Test Detail_Loader Request_Manager behavior (`discovery-page.detail-loader.test.tsx`)
    - Superseding an in-flight detail request aborts the prior one; a 2000 ms detail timeout surfaces the "could not be loaded within 2 seconds" message; a non-supersession failure shows the detail error while the map stays interactive; unmount aborts the in-flight detail request
    - _Requirements: 2.4, 2.5, 2.6, 14.5_

  - [x] 6.4 Test Card_Pipeline wiring and selected-listing reconciliation (`discovery-page.pipeline.test.tsx`)
    - Confirm a successful Viewport_Query replaces displayed listings via the capped→model→`mostNearestSort` pipeline, that `markerListings` matches card order, and that a returned set missing the selected listing clears the selection
    - _Requirements: 1.3, 1.6, 7.1, 8.1_

- [x] 7. Verify client filtering, URL sync, state, and persistence
  - [x] 7.1 Test filter ↔ URL synchronization and viewport re-query (`discovery-page.filters-url.test.tsx`)
    - Changing Active_Filters updates the URL query string (`minPrice`, `maxPrice`, `beds`, `baths`, `type`, `q`) within 500 ms and re-issues the Viewport_Query with those params; removing a filter deletes its parameter; loading with filter params initializes Active_Filters; the same URL reproduces the same filtered view
    - _Requirements: 1.4, 1.5, 6.1, 6.2, 6.3, 13.5_

  - [x] 7.2 Test loading, error, retry, and empty states (`discovery-page.states.test.tsx`)
    - In-flight query shows the loading indication; a failed/timed-out query retains prior listings and shows an error indication with a retry control; retry re-issues the query for the current bounds and shows loading again; a zero-result successful load shows the empty-state content
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 7.3 Test Bottom_Sheet snap persistence (`discovery-page.sheet-persistence.test.tsx`)
    - Changing the snap position persists it to session storage; mounting with a persisted snap restores it; unavailable session storage falls back to the default snap without raising an error
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 7.4 Test deep-link auto-open and route prefetch on mount (`discovery-page.mount.test.tsx`)
    - A `listingId` URL param opens the detail view exactly once per load; `router.prefetch("/listings")` and `router.prefetch("/saved")` each fire exactly once per mount
    - _Requirements: 13.4, 5.5_

  - [x] 7.5 Test POI_Layer degradation and debounce (`use-overpass-pois.behavior.test.ts`)
    - A failed or aborted amenity request leaves listing markers and cards intact without the overlay; active layers debounce the amenity request by at least 600 ms and abort any superseded request
    - _Requirements: 14.3, 14.4_

- [x] 8. Checkpoint - client behavior verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Harden and integration-test the server routes
  - [x] 9.1 Confirm bbox validation and add its property test (`src/features/listings/api.ts`)
    - Audit `parseBbox` enforces exactly four comma-separated finite numbers, longitude in [-180, 180], latitude in [-90, 90]; refactor only if it deviates. Add the property test (`api.parse-bbox.property.test.ts`)
    - **Property 11: bbox validation accepts only four finite in-range coordinates** — `parseBbox` returns a parsed bbox iff the string is four comma-separated finite numbers in range, else a validation error
    - `fast-check` ≥100 runs; tag `Feature: discovery-page-experience, Property 11: bbox validation accepts only four finite in-range coordinates`
    - _Requirements: 3.3, 3.4_

  - [x] 9.2 Test the spatial query and bounded fallback path (`api.viewport.test.ts`)
    - Confirm `getListingsInViewport` calls the single spatial RPC returning all card/marker fields with no per-listing query and published-only results; a simulated missing-spatial-index error routes to `getListingsInViewportFallback` (bbox-bounded, published-only, capped to 250 rows) and records the fallback path; a non-index failure yields a 500 with a correlation `requestId`
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 9.3 Test the minimal field projection (`api.map-row.test.ts`)
    - Confirm `mapListingRow` projects only the viewport view-model fields (id, title, area, price, lat, lng, bedrooms, bathrooms, imageUrls, availabilityDate, created_at) and returns `imageUrls: []` when a listing has no image; confirm the detail payload includes the full detail fields
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 9.4 Integration test Listings_API validation and caching (`src/app/api/listings/route.test.ts`)
    - A missing or malformed `bbox` returns HTTP 400; a successful response carries the exact `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=120` header
    - _Requirements: 3.3, 3.4, 5.1_

  - [x] 9.5 Integration test Detail_API not-found and payload (`src/app/api/listings/[id]/route.test.ts`)
    - An unknown or unpublished listing id returns HTTP 404; a known published id returns the full detail payload in a single response
    - _Requirements: 4.4_

  - [x] 9.6 Integration test rate limiting on both routes (`route.rate-limit.test.ts`)
    - Exceeding 120 requests per client within a 1-minute window returns HTTP 429 with a `Retry-After` header and `X-RateLimit-Limit` / `X-RateLimit-Remaining` headers reflecting the ceiling and remaining count
    - _Requirements: 14.1, 14.2_

- [x] 10. Checkpoint - server routes verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Confirm rendering, code-splitting, and streaming
  - [x] 11.1 Confirm RSC root and Suspense streaming (`app/page.tsx`, `page.render.test.tsx`)
    - Confirm `Home` is a server component that renders only `<Suspense fallback={<DiscoveryPageFallback />}>` around the client `DiscoveryPage`, streams the server-rendered fallback chrome immediately, and does not block first paint on listing data
    - _Requirements: 9.3, 9.4_

  - [x] 11.2 Confirm dynamic map import, debounce, and tile cache (`map-view-loader.test.tsx`)
    - Confirm `MapViewLoader` dynamically imports `MapView` with `ssr: false` and shows `MapViewLoading`, that camera changes are debounced 250 ms before `onBoundsChange`, and that tiles for a previously viewed bounds render from the SDK tile cache without a new request
    - _Requirements: 9.1, 9.2, 1.2, 5.6_

  - [x] 11.3 Confirm image optimization and reduced-motion animation (`listing-card.render.test.tsx`)
    - Confirm listing imagery uses `next/image` with AVIF/WebP and explicit dimensions (`fill` + `sizes`) reserving layout space, a failed image falls back to a placeholder, entrance/settle motion uses transform/opacity only, and `prefers-reduced-motion: reduce` renders the final state without motion
    - _Requirements: 11.5, 12.6, 10.3, 10.5_

  - [x] 11.4 Confirm consistency with existing discovery specs (`discovery-page.consistency.test.tsx`)
    - Confirm the experience renders at the site root `/` without a separate route, supplies the Bottom_Sheet/Listing_Carousel data without redefining their layout, supplies the value-prop/CTA data-fetch without redefining presentation, fires the Viewport_Query when map bounds first resolve regardless of the spotlight, and applies "Closest" as ascending distance from the Distance_Origin
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 12. Add performance budgets and CWV verification
  - [x] 12.1 Add the initial-JS bundle-size budget check
    - Add an automated size check (e.g., a `size-limit`/CI assertion) that fails when the `/` route initial client JavaScript, measured after compression, exceeds 300 KB
    - _Requirements: 9.5_

  - [x] 12.2 Add the viewport payload budget check
    - Add an automated test that builds a viewport response at the 200-listing Marker_Cap and asserts the compressed payload does not exceed 150 KB, and that responses support `Accept-Encoding` negotiated compression
    - _Requirements: 4.2, 4.3_

  - [x] 12.3 Add the Lighthouse/CWV lab verification harness
    - Add a Lighthouse CI configuration for the `/` route on a mid-tier mobile profile asserting Performance ≥ 90, LCP ≤ 2.5s, CLS ≤ 0.1, and INP ≤ 200 ms
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 12.4 Add the interaction frame-rate profiling harness
    - Add a scripted lab harness that profiles pan/zoom and Bottom_Sheet drag against the 16.7 ms (60 FPS) and 8.3 ms (120 FPS) Frame_Budgets and records per-frame work; document results as measured (not asserted as a property test) since they depend on hardware and rendering
    - _Requirements: 10.1, 10.2, 10.4, 10.6_

- [x] 13. Final checkpoint - all budgets and tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test/verification sub-tasks and can be skipped for a faster
  path, but they carry the correctness guarantees of this hardening plan and should not be skipped
  lightly.
- This is a hardening plan over a mature implementation: non-starred tasks (1.1–1.4, 6.1, 9.1) are
  small extraction/audit refactors that create the pure seams the property tests exercise. Where
  existing behavior already conforms, the corresponding task adds or confirms coverage rather than
  rewriting.
- Each task references the specific requirement clauses it verifies; property-test tasks additionally
  reference the design property number and carry the required `Feature: discovery-page-experience,
  Property {n}: {text}` tag and a minimum of 100 `fast-check` iterations.
- Checkpoints ensure incremental validation at the pure-layer, client, server, and budget boundaries.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "9.1"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.2", "2.3", "2.4", "2.5", "3.1", "4.1", "4.2", "4.3", "9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 3, "tasks": ["6.1", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 5, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 6, "tasks": ["12.1", "12.2", "12.3", "12.4"] }
  ]
}
```
