# Requirements Document

## Introduction

RoomZA is a map-based rental discovery app built with Next.js (App Router, React Server Components) and deployed on Cloudflare via OpenNext. The site root (`/`) renders the map-based Discovery experience directly. This spec, **Discovery_Page_Experience**, defines the end-to-end architecture, data, performance, and reliability behavior of that experience: how listings are fetched for the current map viewport, how filtering and sorting are applied, how the map and its markers are rendered and kept performant, how the page is code-split and streamed, how responses are cached, how the request lifecycle is managed, how loading/error/empty states behave, and the measurable performance budgets the whole surface must meet.

This spec is the comprehensive, system-of-record spec for the discovery experience. It is written to raise the existing, mature implementation (rooted in `src/features/map-discovery/discovery-page.tsx` and its `lib/`, `hooks/`, and `mobile/` modules, plus the `/api/listings` route and the `src/features/listings/api.ts` query layer) to the ELITE PERFORMANCE & ARCHITECTURE bar: 60 FPS minimum interaction (120 FPS on supported displays), minimal CPU/RAM/battery/network usage, instant perceived performance, and excellent Core Web Vitals and Lighthouse scores.

### Relationship to existing specs

This spec deliberately owns the concerns that the two narrower existing specs explicitly EXCLUDE, and it MUST remain consistent with — never contradict or redefine — those specs:

- **`.kiro/specs/mobile-map-discovery/`** owns the mobile layout and chrome only (App_Bar, Search_Bar, Listing_Marker visuals, draggable Bottom_Sheet carousel, Sort_Label). It is presentational and explicitly excludes data fetching, filtering, map mechanics, and performance. Where this spec references the Bottom_Sheet, markers, carousel, or sort label as visual containers, it defers their presentation and layout to `mobile-map-discovery` and defines only their data, behavior, and performance.
- **`.kiro/specs/discovery-pop/`** owns first-impression enhancements (Value_Proposition, Primary_Search_CTA, Discovery_Spotlight, Entrance_Animation). It is requirements-only and presentational. Where this spec references the value proposition, search CTA, or entrance motion, it defers their presentation to `discovery-pop` and defines only the data-fetch, interactivity, and performance guarantees around them.

Where behavior overlaps, this spec references the existing specs rather than restating their presentational acceptance criteria. This spec does not introduce a separate route; the Discovery_Page_Experience renders at the site root path (`/`).

## Glossary

- **Discovery_Page_Experience**: The complete map-based Discovery system rendered at the site root path (`/`), comprising the Map_Surface, the Viewport_Query, the Card_Pipeline, the Marker_Layer, the Request_Manager, the Detail_Loader, the Cache_Layer, the POI_Layer, and the loading/error/empty states that connect them.
- **Map_Surface**: The interactive map component (Google Maps via `@vis.gl/react-google-maps`) that displays listing markers and reports its camera bounds. Its visual presentation on mobile is defined by `mobile-map-discovery`.
- **Viewport_Bounds**: The geographic rectangle of the currently visible map area, expressed as `west,south,east,north` decimal degrees.
- **Viewport_Query**: The client-initiated request to `/api/listings` that loads the listings within the current Viewport_Bounds and active filters.
- **Listings_API**: The server route `GET /api/listings` that validates the query, executes the geospatial lookup, and returns the listings for a Viewport_Bounds.
- **Detail_Loader**: The client-initiated request to `/api/listings/{id}` that loads a single listing's detail payload.
- **Request_Manager**: The client-side mechanism that supersedes in-flight requests, bounds each request with a timeout, and cancels obsolete requests using an `AbortController`.
- **Card_Pipeline**: The pure client transform that caps the raw listings, maps them to Listing_Card_Model view models (numeric price, nullable rating/review count, computed `distanceKm`), and applies the "Most Nearest" ordering.
- **Listing_Card_Model**: The view model consumed by the listing cards and carousel, defined in `src/features/map-discovery/lib/types.ts`.
- **Distance_Origin**: The geographic point used to compute `distanceKm`, resolved as the visitor's geolocation when available, otherwise the Map_Surface center (midpoint of the Viewport_Bounds), otherwise null.
- **Marker_Layer**: The set of listing markers rendered on the Map_Surface, derived from the same capped and sorted order as the cards.
- **Marker_Cap**: The maximum number of individual listing markers rendered before clustering applies (`MAX_MARKERS = 200`).
- **Cluster_Threshold**: The in-viewport marker count above which markers render as clusters rather than individual pins (`MARKER_CLUSTER_THRESHOLD = 200`).
- **Camera_Debounce**: The delay applied to Map_Surface camera-change events before a Viewport_Query is issued (currently 250 ms).
- **Cache_Layer**: The layered response caching applied to Listings_API responses, comprising the edge/CDN cache (`s-maxage`, `stale-while-revalidate`) and any client-held cached responses.
- **POI_Layer**: The optional points-of-interest overlay that fetches amenity data (from Overpass and static datasets) for the current Viewport_Bounds when one or more layers are active.
- **Active_Filters**: The set of listing filters (`minPrice`, `maxPrice`, `beds`, `baths`, `type`, `q`) that are synchronized with the URL query string.
- **Sort_Order**: The active ordering selection for the desktop grid, one of "Latest", "Price: Low to High", "Price: High to Low", or "Closest".
- **View_Mode**: The desktop presentation selection, either the map view or the grid view.
- **Reduced_Motion_Preference**: The setting exposed via the `prefers-reduced-motion: reduce` media query.
- **Frame_Budget**: The per-frame render time ceiling for a target frame rate: 16.7 ms for 60 FPS, 8.3 ms for 120 FPS.
- **LCP**: Largest Contentful Paint, a Core Web Vitals metric.
- **CLS**: Cumulative Layout Shift, a Core Web Vitals metric.
- **INP**: Interaction to Next Paint, a Core Web Vitals metric.
- **Mobile_Viewport**: A viewport with a width below 1024px.
- **Bottom_Sheet**: The draggable mobile listings panel whose layout and interaction are defined by `mobile-map-discovery`; this spec defines only the data it displays and the performance of its animation.

## Requirements

### Requirement 1: Viewport-based listing loading

**User Story:** As a visitor browsing the map, I want the listings to reflect exactly what is in view, so that I only load and see homes relevant to the area I am looking at.

#### Acceptance Criteria

1. WHEN the Map_Surface reports a new Viewport_Bounds, THE Viewport_Query SHALL request listings for that Viewport_Bounds by sending the bounds as a `bbox` parameter formatted as `west,south,east,north` with each coordinate rounded to 6 decimal places.
2. WHEN the Map_Surface camera changes, THE Discovery_Page_Experience SHALL wait for a Camera_Debounce of 250 milliseconds of camera inactivity before issuing the Viewport_Query.
3. WHEN a Viewport_Query returns successfully, THE Discovery_Page_Experience SHALL replace the displayed listings with the returned listings.
4. WHEN the Active_Filters change, THE Viewport_Query SHALL re-request listings for the current Viewport_Bounds using the updated Active_Filters.
5. THE Viewport_Query SHALL include the active `q`, `minPrice`, `maxPrice`, `beds`, `baths`, and `type` values from the URL query string as request parameters.
6. WHEN a Viewport_Query returns successfully AND the currently selected listing is absent from the returned listings, THE Discovery_Page_Experience SHALL clear the selected listing.

### Requirement 2: Request lifecycle, supersession, and cancellation

**User Story:** As a visitor who pans and zooms quickly, I want stale requests to be cancelled, so that the map never shows results for a viewport I have already moved past and never wastes network or CPU.

#### Acceptance Criteria

1. WHEN a new Viewport_Query is issued WHILE a previous Viewport_Query is in flight, THE Request_Manager SHALL abort the previous Viewport_Query before issuing the new Viewport_Query.
2. WHEN a Viewport_Query is aborted because it was superseded by a newer Viewport_Query, THE Discovery_Page_Experience SHALL NOT display an error indication for the aborted Viewport_Query.
3. IF a Viewport_Query does not complete within 2000 milliseconds, THEN THE Request_Manager SHALL abort the Viewport_Query and THE Discovery_Page_Experience SHALL display an error indication for the failed load.
4. WHEN a new Detail_Loader request is issued WHILE a previous Detail_Loader request is in flight, THE Request_Manager SHALL abort the previous Detail_Loader request before issuing the new one.
5. IF a Detail_Loader request does not complete within 2000 milliseconds, THEN THE Request_Manager SHALL abort the Detail_Loader request and THE Discovery_Page_Experience SHALL display a message indicating that listing details could not be loaded within 2 seconds.
6. WHEN the Discovery_Page_Experience unmounts, THE Request_Manager SHALL abort every in-flight Viewport_Query and Detail_Loader request.

### Requirement 3: Efficient geospatial queries on the server

**User Story:** As an operator, I want viewport queries to run against an indexed geospatial lookup without N+1 access, so that response times stay low as the listing dataset grows.

#### Acceptance Criteria

1. WHEN the Listings_API receives a request, THE Listings_API SHALL execute a single spatial query that returns all listing fields required for the card and marker view models without issuing a separate per-listing query.
2. IF the spatial index required by the primary query is unavailable, THEN THE Listings_API SHALL execute a bounded fallback query constrained to the Viewport_Bounds, limit the fallback result to 250 listings, and record that the fallback path was used.
3. WHEN the Listings_API receives a request whose `bbox` is missing or is not four comma-separated finite numbers, THE Listings_API SHALL return a validation error with HTTP status 400.
4. WHEN the Listings_API receives a `bbox` whose longitude values fall outside -180 to 180 or whose latitude values fall outside -90 to 90, THE Listings_API SHALL return a validation error with HTTP status 400.
5. WHEN the Listings_API query succeeds, THE Listings_API SHALL return only published listings within the Viewport_Bounds.
6. IF the Listings_API spatial query fails for a reason other than a missing spatial index, THEN THE Listings_API SHALL return a server error with HTTP status 500 and a correlation request identifier.

### Requirement 4: Minimal payloads and field selection

**User Story:** As a visitor on a constrained connection, I want viewport responses to carry only the fields the map needs, so that data transfer and parse time stay minimal.

#### Acceptance Criteria

1. THE Listings_API SHALL return, for each listing in a viewport response, only the fields consumed by the card and marker view models: identifier, title, area, price, latitude, longitude, bedrooms, bathrooms, image URLs, availability date, and creation timestamp.
2. WHEN the Listings_API returns a viewport response, THE Listings_API SHALL support HTTP response compression negotiated via the request `Accept-Encoding` header.
3. THE Listings_API viewport response payload, measured after compression for a viewport containing up to the Marker_Cap of listings, SHALL NOT exceed 150 kilobytes.
4. THE Detail_Loader response SHALL include the full detail fields required by the listing detail panel in a single response.
5. WHERE a listing has no image, THE Listings_API SHALL return an empty image URL collection for that listing rather than omitting the field.

### Requirement 5: Layered response caching

**User Story:** As a visitor revisiting an area, I want previously fetched viewports to load from cache, so that repeat views are instant and origin load is minimized.

#### Acceptance Criteria

1. WHEN the Listings_API returns a successful viewport response, THE Listings_API SHALL set a `Cache-Control` header enabling shared-cache storage with `s-maxage` of 30 seconds and `stale-while-revalidate` of 120 seconds.
2. WHILE a cached Listings_API response is older than its 30-second `s-maxage` but within the 120-second `stale-while-revalidate` window, THE Cache_Layer SHALL return the cached response to the caller within the same request and trigger a background revalidation without blocking the response on the origin.
3. IF a background revalidation triggered under the `stale-while-revalidate` window fails to obtain a successful origin response, THEN THE Cache_Layer SHALL continue serving the existing cached response until it exceeds the 120-second `stale-while-revalidate` window.
4. WHEN the POI_Layer requests amenity data for a Viewport_Bounds whose cache key already exists in its in-memory cache, THE POI_Layer SHALL return the previously fetched amenity data from that in-memory cache instead of issuing a new request, using a cache key composed of the layer identifier and the Viewport_Bounds coordinates rounded to 0.01-degree precision.
5. WHEN the Discovery_Page_Experience completes mounting, THE Discovery_Page_Experience SHALL issue prefetch requests for the `/listings` and `/saved` routes exactly once per mount.
6. WHERE map tiles for a Viewport_Bounds are present in the Map_Surface tile cache, THE Map_Surface SHALL render those tiles from the tile cache without issuing a new tile request for that Viewport_Bounds.

### Requirement 6: Filtering and sorting

**User Story:** As a visitor refining my search, I want filters and sort order to be applied consistently and reflected in the URL, so that my refined view is shareable and reproducible.

#### Acceptance Criteria

1. WHEN the visitor changes the Active_Filters, THE Discovery_Page_Experience SHALL update the URL query string to reflect the current `minPrice`, `maxPrice`, `beds`, `baths`, `type`, and `q` values within 500 milliseconds.
2. WHEN the visitor removes a filter value, THE Discovery_Page_Experience SHALL delete the corresponding parameter from the URL query string.
3. WHEN the Discovery_Page_Experience loads with filter parameters present in the URL query string, THE Discovery_Page_Experience SHALL initialize the Active_Filters from those parameters.
4. WHEN the Sort_Order is "Price: Low to High", THE Discovery_Page_Experience SHALL order the grid listings so that each listing's price is greater than or equal to the price of the listing immediately preceding it.
5. WHEN the Sort_Order is "Price: High to Low", THE Discovery_Page_Experience SHALL order the grid listings so that each listing's price is less than or equal to the price of the listing immediately preceding it.
6. WHEN the Sort_Order is "Closest" AND the Distance_Origin is determinable, THE Discovery_Page_Experience SHALL order the grid listings by ascending distance from the Distance_Origin.
7. WHEN the Sort_Order is "Latest", THE Discovery_Page_Experience SHALL order the grid listings by descending creation timestamp.

### Requirement 7: Card pipeline and distance origin

**User Story:** As a visitor, I want the listing cards to show accurate distances ordered nearest-first, so that I can quickly find the closest homes.

#### Acceptance Criteria

1. THE Card_Pipeline SHALL cap the raw listings to at most the Marker_Cap of 200 items, preserving input order, before producing Listing_Card_Models.
2. THE Card_Pipeline SHALL compute each Listing_Card_Model's `distanceKm` as the great-circle (haversine) distance from the Distance_Origin to the listing's coordinates.
3. WHEN the visitor's geolocation is available, THE Discovery_Page_Experience SHALL resolve the Distance_Origin to the visitor's geolocation.
4. IF the visitor's geolocation is unavailable, denied, or not determined within 10000 milliseconds, THEN THE Discovery_Page_Experience SHALL resolve the Distance_Origin to the Map_Surface center computed as the midpoint of the current Viewport_Bounds.
5. IF neither the visitor's geolocation nor a Viewport_Bounds is available, THEN THE Card_Pipeline SHALL set each Listing_Card_Model's `distanceKm` to null.
6. THE Card_Pipeline SHALL order the Listing_Card_Models by ascending `distanceKm`, placing every model whose `distanceKm` is null after all models with a determinable distance, and preserving input order among models with equal distance.

### Requirement 8: Marker layer alignment and virtualization

**User Story:** As a visitor, I want the map markers to match the cards and stay performant even in dense areas, so that tapping a marker selects the right listing without the map stuttering.

#### Acceptance Criteria

1. THE Marker_Layer SHALL derive its markers from the same capped and sorted order as the Card_Pipeline output so that marker order matches card order.
2. WHEN the number of listings in view is at or below the Cluster_Threshold of 200, THE Marker_Layer SHALL render one individual marker per listing.
3. WHEN the number of listings in view exceeds the Cluster_Threshold of 200, THE Marker_Layer SHALL render the markers as spatial clusters rather than individual pins.
4. WHEN the visitor activates a marker, THE Discovery_Page_Experience SHALL select the listing whose identifier matches the activated marker.
5. THE Marker_Layer SHALL render markers only for listings within the current Viewport_Bounds.
6. WHERE a listing thumbnail is unavailable, THE Marker_Layer SHALL render the marker without a thumbnail image rather than omitting the marker.

### Requirement 9: Rendering strategy and code splitting

**User Story:** As a visitor, I want the discovery page to send minimal JavaScript up front and stream content progressively, so that the page becomes interactive quickly.

#### Acceptance Criteria

1. THE Discovery_Page_Experience SHALL load the Map_Surface implementation through a dynamic import so that the map library is excluded from the initial route JavaScript bundle.
2. WHILE the Map_Surface implementation is loading, THE Discovery_Page_Experience SHALL display a fallback placeholder in place of the map.
3. THE Discovery_Page_Experience SHALL render server-eligible content as React Server Components so that only interactive components are shipped as client JavaScript.
4. WHEN the Discovery_Page_Experience is server-rendered, THE Discovery_Page_Experience SHALL stream content to the client using progressive rendering rather than blocking the initial response on the full listing data.
5. THE initial client JavaScript transferred for the site root route, measured after compression, SHALL NOT exceed 300 kilobytes.

### Requirement 10: Interaction frame rate and animation performance

**User Story:** As a visitor interacting with the map and bottom sheet, I want animations and gestures to stay smooth, so that the experience feels instant and never janky.

#### Acceptance Criteria

1. WHILE the visitor pans or zooms the Map_Surface, THE Discovery_Page_Experience SHALL sustain a rendering frame rate of at least 60 frames per second on supported hardware, keeping per-frame work within the 60 FPS Frame_Budget of 16.7 milliseconds.
2. WHERE the display supports a refresh rate above 60 hertz, THE Discovery_Page_Experience SHALL target the display's refresh rate up to 120 frames per second, keeping per-frame work within the 120 FPS Frame_Budget of 8.3 milliseconds.
3. THE Discovery_Page_Experience SHALL animate the Bottom_Sheet position and any card entrance motion using GPU-accelerated transform and opacity properties rather than properties that trigger layout reflow.
4. WHILE the visitor is dragging the Bottom_Sheet, THE Discovery_Page_Experience SHALL update the Bottom_Sheet position within one animation frame of each pointer movement.
5. IF the Reduced_Motion_Preference is set to reduce, THEN THE Discovery_Page_Experience SHALL present listing entrance and sheet-settle transitions in their final state without motion.
6. WHEN the visitor activates a control on the Discovery_Page_Experience, THE Discovery_Page_Experience SHALL begin a visible response to that interaction within 100 milliseconds.

### Requirement 11: Core Web Vitals and performance budgets

**User Story:** As a product owner, I want the discovery page to meet strong Core Web Vitals and Lighthouse targets, so that the experience is fast for real users and ranks well.

#### Acceptance Criteria

1. THE Discovery_Page_Experience SHALL achieve a Largest Contentful Paint (LCP) of 2.5 seconds or less at the 75th percentile of loads on a mid-tier mobile device over a 4G connection.
2. THE Discovery_Page_Experience SHALL maintain a Cumulative Layout Shift (CLS) of 0.1 or less from initial render through completion of listing and marker rendering.
3. THE Discovery_Page_Experience SHALL achieve an Interaction to Next Paint (INP) of 200 milliseconds or less at the 75th percentile of interactions.
4. THE Discovery_Page_Experience SHALL achieve a Lighthouse Performance score of at least 90 in a lab audit on a mid-tier mobile profile.
5. WHEN the Discovery_Page_Experience renders listing imagery, THE Discovery_Page_Experience SHALL serve images in AVIF or WebP format with explicit width and height so that images reserve layout space before loading.

### Requirement 12: Loading, error, and empty states

**User Story:** As a visitor, I want clear feedback while listings load, fail, or come back empty, so that I always understand the state of the map and can recover.

#### Acceptance Criteria

1. WHILE a Viewport_Query is in flight, THE Discovery_Page_Experience SHALL display a loading indication for the listings.
2. WHEN a Viewport_Query fails with an error or times out, THE Discovery_Page_Experience SHALL retain the previously displayed listings until a subsequent Viewport_Query succeeds.
3. WHEN a Viewport_Query fails with an error or times out, THE Discovery_Page_Experience SHALL display an error indication with a retry control.
4. WHEN the visitor activates the retry control, THE Discovery_Page_Experience SHALL re-issue the Viewport_Query for the current Viewport_Bounds and display the loading indication.
5. WHEN a Viewport_Query returns zero listings AND loading has completed without error, THE Discovery_Page_Experience SHALL display the empty-state content that prompts the visitor to explore the map or join the area waitlist.
6. IF a listing image fails to load, THEN THE Discovery_Page_Experience SHALL display a placeholder image in place of the failed image.

### Requirement 13: State persistence and deep linking

**User Story:** As a visitor, I want my view preferences and shared links to be preserved, so that returning to discovery or opening a shared link restores the expected state.

#### Acceptance Criteria

1. WHEN the visitor changes the Bottom_Sheet snap position, THE Discovery_Page_Experience SHALL persist the new snap position to browser session storage.
2. WHEN the Discovery_Page_Experience mounts AND a persisted Bottom_Sheet snap position exists in browser session storage, THE Discovery_Page_Experience SHALL restore the Bottom_Sheet to that snap position.
3. IF browser session storage is unavailable, THEN THE Discovery_Page_Experience SHALL continue to operate using the default Bottom_Sheet snap position without raising an error to the visitor.
4. WHEN the Discovery_Page_Experience loads with a `listingId` parameter in the URL query string, THE Discovery_Page_Experience SHALL open the detail view for that listing exactly once per load.
5. THE Active_Filters and the search query SHALL be reproducible from the URL query string so that opening the same URL yields the same filtered view.

### Requirement 14: Reliability and graceful degradation

**User Story:** As an operator, I want the discovery page to protect the origin and degrade gracefully under load or partial failure, so that the experience stays available.

#### Acceptance Criteria

1. WHEN the Listings_API receives more than 120 requests from the same client within a 1-minute window, THE Listings_API SHALL respond with HTTP status 429 and a `Retry-After` header.
2. WHEN the Listings_API returns a rate-limited response, THE Listings_API SHALL include the rate-limit ceiling and remaining-request count in response headers.
3. IF the POI_Layer amenity request fails or is aborted, THEN THE Discovery_Page_Experience SHALL continue to display the listing markers and cards without the amenity overlay.
4. WHILE one or more POI_Layer layers are active, THE POI_Layer SHALL debounce its amenity request by at least 600 milliseconds and abort any superseded amenity request.
5. IF the Detail_Loader request fails for a reason other than supersession, THEN THE Discovery_Page_Experience SHALL display a message indicating that listing details could not be loaded while keeping the Map_Surface interactive.

### Requirement 15: Consistency with existing discovery specs

**User Story:** As a product owner, I want this comprehensive spec to stay consistent with the mobile layout and first-impression specs, so that the specs compose without contradiction.

#### Acceptance Criteria

1. THE Discovery_Page_Experience SHALL render at the site root path (`/`) without registering or redirecting to any separate route.
2. THE Discovery_Page_Experience SHALL supply the listing data displayed within the Bottom_Sheet and Listing_Carousel whose layout and interaction are defined by `mobile-map-discovery`, without redefining that layout or interaction.
3. THE Discovery_Page_Experience SHALL supply the data-fetch, interactivity, and performance behavior underlying the Value_Proposition and Primary_Search_CTA whose presentation is defined by `discovery-pop`, without redefining that presentation.
4. WHEN the Map_Surface bounds first resolve, THE Discovery_Page_Experience SHALL trigger the Viewport_Query regardless of whether the Discovery_Spotlight defined by `discovery-pop` is displayed.
5. THE Discovery_Page_Experience SHALL apply the "Closest" ordering it produces consistently with the Sort_Label semantics defined by `mobile-map-discovery`, ordering by ascending distance from the Distance_Origin.
