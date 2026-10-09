# Automatic category viewport discovery — deployed and verified

Deployed on 8 October 2026 following the user's explicit “Go” authorization. The hosted migration, prepared Worker release and one new focused browser session are complete. The browser check passed, and this authorization's single session is now spent.

Shopping, Tourism, Events and Services now request cards and pins on initial map load and after settled movement. They retain their separate tabs and existing cards. Initial positioning follows Property's current-location behavior and Johannesburg fallback. A chosen location moves the camera; later requests use the map bounds and can include other areas. Results no longer automatically fit or recenter the map, including refreshes of a selected card. Explicit controls and selections still move it.

Settled bounds replace the `bbox` query parameter without adding history entries. Category links carry those bounds. A shared bbox takes precedence over areaId; an older area link resolves its place before map positioning. Loading, empty, refresh-error and retry states replace mandatory location onboarding. Failed refreshes retain the previous cards and pins, while expiry deadlines remain active.

## Public reader and preservation

`GET /api/discovery/viewport` validates category, bbox, q, sort and serviceType, returns no-store responses and validates category-specific existing public DTOs. Search and service filters run before the 250-item cap; totalCount is the full matching count. Nearest uses distance from the viewport centre. Existing sort defaults, exact visibility windows, Upcoming Event state and area-feed/publication interfaces are preserved.

The additive migration creates only `pinpoint_shopping_viewport` and `pinpoint_discovery_viewport`. Shopping calls the existing reviewed public snapshot inside a narrow definer function. Entries and Services use the existing approved relations under caller RLS. Only anon/authenticated receive execution rights on these new readers. Existing grants, RLS policies, publication records, account settings, notifications, images and audit history are untouched. The application uses the anonymous key, not a service key.

## Completed evidence

| Check | Result |
| --- | --- |
| Isolated release regression/component/API tests | 103 passed across 17 files |
| TypeScript | Passed in the workspace and isolated release |
| Full release lint | 0 errors; 22 existing warnings |
| Patched disposable PostgreSQL clone | 35 checks passed; all fixtures rolled back |
| Clone coverage | Anonymous/authenticated reads, all four categories, empty bounds, suspended/withdrawn/expired content, future Tourism/Shopping hidden, Upcoming Events visible, search/type before cap, 250 items with full count, malformed SQL inputs, closed private snapshot ACL, actual PostgREST RPC |
| Rollback rehearsal | Both new readers dropped inside a transaction and restored by rollback; original catalog and data preserved |
| Production OpenNext build | Passed; existing middleware/duplicate-status/dependency warnings retained in build log |
| Client JS budgets | Passed; Property initial compressed JS 251.5 KB against 300 KB |
| Discovery assets | Three public HTML/RSC shells prepared |
| Worker dry-run | Passed; Wrangler gzip 3053.95 KiB, below 3072 KiB; strongest-gzip script check 3044.2 KiB |

Client checks cover no-area routes, initial reporting, permission denial, late geolocation, choosing a location then leaving its suburb, shared bounds and category links, identical card/pin inputs, camera stability, superseded responses, failed refreshes and expiry during a failed moved-viewport refresh. Property regression checks cover rental/sale filters, navigation request behavior, and the recent query-free-shell URL hydration repair. The live browser check separately passed automatic initial requests, pins without card clicks, drag refresh, shared-link restoration, category switching and the Upcoming label, with no page errors.

The initial clone run passed 33 checks. A later expanded fixture check expected one plumber although two additional synthetic fixture batches also contained plumbers; the assertion was corrected to three. Its failed evidence is retained. The final 35 checks passed. The shared source database, container identities, configuration, original functions, grants and Property hashes remained unchanged. Internal networking, disabled cron execution and unavailable SMTP prevented external effects. The clone's labelled containers, volume and network were removed.

## Isolated release

Manifest: `artifacts/discovery-viewport-20261008/release.json`. Snapshot: `C:\Users\BB\AppData\Local\Temp\pinpoint-viewport-release-2fce5621-9a8e-4bae-a7e7-1ff4b3ebc2a6`.

The snapshot overlays this repair onto the last deployed source. It excludes unrelated unshipped changes in next.config.ts, report-panel.tsx, the Property discovery-page.tsx, listing-detail-panel.tsx and connect-now-sheet.tsx. Those workspace files remain intact. Dependencies are hardlinks to the locked last-deployed installation; source files are independent copies. The build received public environment values only. Repair and artifact hashes are retained and checked for drift.

Fresh read-only preflight at 15:16 UTC confirmed the live deployment still uses Worker version `29167213-1fce-439b-a284-7f481efd21e1`, deployment `5bc9fd20-bcdc-4ae8-bad5-2e92dd070972`, with 100% traffic. All migration dependencies through `20261006181312_pinpoint_phase4_platform` are present. The new viewport reader is absent. Live counts remain ten accounts, three Properties, five Property image rows, seven Storage objects, two Shopping Offers, four approved Tourism/Event entries and two approved Services. This task made no live data writes.

## Completed hosted release

1. The fresh baseline and repair hashes matched. Only the tested viewport-reader migration was applied to `qleeedwnnfvmfjjymoco`. Supabase recorded version `20261008165344`; the local SQL filename and isolated snapshot were aligned to that version without changing SQL contents or editing hosted migration history. The original tested filename was `20261008142905_pinpoint_discovery_viewport.sql`, retained in clone evidence and recorded in the release manifest.
2. Live anonymous database queries returned two listings per category, one Upcoming Event, one Plumbing result and one pastry search result. Data counts after release equal the fresh baseline. Worker version `987dbb29-6e57-4b05-81f3-1e87b801680a`, deployment `8c0bfd01-09e9-4a7f-83b3-66f47673216b`, serves 100% of traffic. Binding and runtime metadata match the previous live version. All 24 live HTTP checks passed, including default/Nearest feeds, empty bounds, filters, malformed queries, category shells and Property rent/buy shells.
3. Exactly one new browser session passed seven stages. It tested a no-area initial request with denied location, bbox-only demo pins without a card click, automatic drag refresh, shared-link restoration and switches through Tourism, Events and Services with Upcoming visible. Trace, screenshots and results are retained at `artifacts/discovery-viewport-20261008/browser-2026-10-08T17-03-48-193Z-854f3857-babe-4d9b-b794-21c64ca22ea9/`. There were no browser retries or page errors.

Cloudflare's first upload attempt failed on a network request, and the immediate retry failed during the read-only deployment preflight. Connectivity recovered using IPv4 DNS preference; the next attempt completed. Failure logs are retained. No application source changes or rebuilds were needed. Concurrent unshipped changes and the demo importer were excluded throughout.

Browser script: `artifacts/discovery-viewport-20261008/focused-live-browser.prepared.cjs`, copied to a unique temporary driver and executed using the Playwright skill executor. Its approval environment guard is an execution safeguard; human authorization came from the user's “Go” message.

## Rollback

Restore the verified previous Worker version `29167213-1fce-439b-a284-7f481efd21e1` first. Then, if the new readers need removal, apply `artifacts/discovery-viewport-20261008/rollback.sql`, which drops only those two functions. Retain migration/audit history and record rollback evidence; do not delete migration history rows, accounts, listings, images or publication records. The function rollback was rehearsed on the disposable clone.

All logs, source hashes, clone evidence, read-only preflight, rollback SQL and the prepared browser driver are retained under `artifacts/discovery-viewport-20261008/`.
