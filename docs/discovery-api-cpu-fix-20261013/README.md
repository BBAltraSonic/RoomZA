# Deployed discovery API CPU repair — 13 October 2026

Deployed after explicit user authorization. App version `d3cd504e-d550-4efc-a170-cf12bf37bc27`, deployment `8954ea61-82d0-4a82-9a82-7074144552de`, serves 100% of traffic. The internal API Worker is version `88524462-39f8-4832-9dbd-af228505dfcd`, deployment `c4835282-67d6-4c96-a047-873c28b6761a`, also at 100%. Previous app version `47d27e5a-7c64-4f3a-921f-4adb2791c086` remains the rollback candidate.

Ten live API checks passed with the new `x-roomza-api: discovery-worker` marker and security headers. The exact screenshot bounds returned one rental, one sale listing, and two items in each Shopping, Places, Events, and Services category. All three served public page assets matched their release hashes. The ten prior bindings and runtime settings were verified unchanged; only `DISCOVERY_API` was added. The internal Worker's public and preview URLs are disabled.

Post-cutover telemetry from 18:12:43 to 18:24:41 UTC (20:12:43–20:24:41 SAST) contains 123 fetch events with zero `exceededCpu` outcomes. The main Worker's repaired reads use 0–2 ms CPU. The internal Worker is separate; its viewport calls used 5–37 ms, with no CPU-limit failures in this observed window. This is bounded verification, not a guarantee about future traffic or all private routes.

Read-only in-app browser verification showed both Specials and their map markers, and Property's valid empty state for Johannesburg. Browser history/refresh testing also produced one transient refresh banner while retaining results; explicit Retry recovered, and the final screenshot shows two listings with no banner. Corresponding recent server requests returned 200 in 156–477 ms. No speculative frontend timeout change was made without a confirmed client-side cause. Real signed-in saved-items/inbox flows and private SSR remain unverified.

Screenshots are retained as `live-specials.jpg` and `live-property.jpg`; HTTP, CPU, and binding evidence are in `live-check.json`, `live-cpu.json`, and `live-settings.json`.

Live requests reproduced HTTP 503 / Cloudflare error 1102. Cloudflare invocation logs confirmed `exceededCpu` at 10 ms on the Property, Specials viewport, saved Specials, saved homes, notification inbox, navigation-account, and some private page requests. This scoped repair addresses the five discovery read endpoints below; navigation-account and private SSR remain on Next and need separate verification.

The existing app Worker forwards only GET requests for `/api/listings`, `/api/discovery/viewport`, `/api/saved-specials`, `/api/favorites`, and `/api/notifications` to a small internal `roomza-discovery-api` Worker. The Worker compiles the existing application handlers, validators, published-data queries, rate limiter, and privacy rules. It implements the existing Supabase SSR cookie contract and the middleware's verified-session refresh / suspended-account gate without loading Next's server runtime. Mutations, detail APIs, server actions, and other routes retain their existing path.

The service has no public or preview URL. The main Worker replaces caller Authorization input with the three existing server credentials required by these handlers, transported through the internal service binding in the standard redacted Authorization header. The API Worker keeps these values and cookies in AsyncLocalStorage request context; it never writes them into the shared process environment. No new stored secret, database migration, inventory write, account mutation, subscription change, or paid-plan upgrade is included.

## Evidence

- 37 focused tests passed. Coverage includes existing viewport / saved-Special contracts, exact forwarding scope, mutation and private-route fallthrough, caller-credential replacement, session rotation, suspension denial, private error handling, and concurrent cookie/client isolation.
- Application TypeScript, scoped ESLint, and `git diff --check` passed.
- Ten compiled-Worker checks against production read-only RPCs passed. Your exact map bounds returned one rental, one sale listing, and two Shopping Specials. All four Specials/Services viewport categories loaded. Guest saved-state responses and notification denial matched their contracts. Listing request counters were consumed normally through the existing rate limiter.
- The same ten checks passed in local workerd. Installed Wrangler 4.112.0's local runtime supports dates only through 2026-07-21, so the local runtime check explicitly used the app's existing 2026-05-26 compatibility date. The new Worker's configured production date 2026-10-13 was subsequently confirmed live.
- Both isolated Worker dry runs passed. Main app packaging is 12,762.22 KiB / 2,988.89 KiB gzip; API packaging is 583.58 KiB / 126.32 KiB gzip. Both are below the current 64 MiB uncompressed Worker limit.
- 940 application source hashes match the retained deployed source. The release reuses the verified production compilation and preserves 2,216 compiled files unchanged. Only the main Worker adapter is replaced, a routing module is added, and the self-contained API bundle / service binding are added. Application pages/assets are not rebuilt or replaced with different content.

`release.json` records the isolated snapshot, source hashes, bundle hashes, previous version/deployment, and packaging checks. `runtime-check.json` and `workerd-check.json` separate Node and Cloudflare-local evidence. The live CPU diagnosis was read from Cloudflare telemetry without retaining request headers or private payloads.

## Deployment and continuation

Source and bundle hashes and the current production version were rechecked before upload. The internal API Worker was deployed first, followed by the isolated main artifact, both using `--keep-vars`. Existing variables and secret bindings were preserved. No database migration or data rollback was performed. Future standard Cloudflare deployments now build the native API alongside the discovery assets and deploy it before the main app, preserving variables for both Workers.

Rollback candidate is app version `47d27e5a-7c64-4f3a-921f-4adb2791c086`, deployment `755d1359-3ff4-400d-acc9-de69633fceaf`. Reverting the main app version removes forwarding; the internal Worker can remain unused. No database rollback or data deletion is required.

Cloudflare references: [CPU limits and error 1102](https://developers.cloudflare.com/workers/platform/limits/#cpu-time), [internal service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/).
