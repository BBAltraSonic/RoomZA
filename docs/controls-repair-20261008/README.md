# Pinpoint controls repair, 8 October 2026

Deployed to [Pinpoint](https://roomza.pinpoint-roomza.workers.dev): Worker 06dae702-320f-4660-86dd-89850eb64782, 100% traffic. Deployment ad6bd981-df25-4110-92db-d62a19c593a8, activated 2026-10-08T09:46:20.189673Z.

## Corrected controls

- Shopping, Tourism/Event Specials and Services always provide search in the same shared header slot as Property. Mobile search appears without opening Refine. Sorting and service-type controls are available before location selection. Search/filter choices survive choosing a location. Search remains scoped to the current loaded page; no location or inventory is assumed.
- Specials and Services maps use the existing toolbar: Locate me, zoom, Nearby, Show results and directions when a result is selected. Nearby reuses the existing categories/panel with cancellable requests. Show results fits filtered points, the selected place or the South Africa overview. Camera feedback honors reduced motion; late geolocation cannot affect an unmounted page. Controls appear without waiting for an entrance animation.
- Property map pin cards and their existing actions remain intact. The Nearby panel was extracted without changing its UI, avoiding imports of Property cards, favorites and clustering into category maps.

## Cross-application audit

All 27 production TSX components changed during the rendering-race implementation were compared with retained task-start source. Static JSX control inventories and labels match; no additional removed control was found. Header CSS and the category map were unchanged during that implementation. The empty areas came from location-gated search/sorting and the limited category toolbar. This is a source audit, not visual execution on every route. [Inventory and findings](implementation-control-audit.json).

## Verification

- 35 focused tests across eight files passed, including Property map behavior, first-visit controls and URL state. Six final map tests also passed; these overlap the 35 and are not additive.
- TypeScript passed. Targeted lint had zero errors and one existing internal-navigation warning in Property map code.
- Isolated lockfile installation and Cloudflare build passed. All 91 measured routes meet the 1,300 KB JS budget; initial Property JS is 252.6 KB gzip against 300 KB. Worker artifact 3007.9 KiB gzip against 3,072 KiB; Wrangler upload 3,018.27 KiB. Existing dependency and bundler warnings remain in logs.
- 25 read-only HTTP checks, 39 initial-script/MapLibre asset hashes and seven search/map-control/CSS asset checks passed. The new version serves 100% traffic with all existing Worker bindings and public variable values preserved.
- Preservation check found no unexpected changes outside the 13 intended source/test/CSS files and this evidence folder. Shared .env.local, package-lock.json and the empty Git index remain preserved. No database/schema, fixture, shared-stack or runtime-secret changes. Only existing public settings were supplied to the isolated build.

## Limits and rollback

No browser attempt was made; the earlier cap remains exhausted. Viewport layout, hydrated production actions, real geolocation/directions and production Web Vitals remain unverified in a browser. Discovery static HTML uses the existing visible Suspense loading fallback. An initial pre-upload assertion incorrectly expected finished search labels and stopped before upload; corrected checks verify compiled controls and explicit loading output. See preupload-check-note.json and smoke.json. The earlier live startup timeout remains unresolved.

Previous Worker b5a8da34-bfa3-4dc7-8dfe-ff64ed74b6f9, deployment 7905b136-96d6-4862-ad5b-264c1f9649c7, is retained as a rollback candidate. No rollback was needed.

[Release manifest](release.json), [source patch](source.patch), [HTTP evidence](smoke.json), [control/CSS assets](control-assets.json), [rollout](rollout.json), and test/typecheck/lint/build/deploy logs are retained here.
