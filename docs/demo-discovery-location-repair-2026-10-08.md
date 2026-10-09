# Discovery location repair — 8 October 2026

Status: deployed; one focused live desktop browser check passed. Release evidence is in [the deployment report](discovery-location-deploy-20261008/README.md).

## Reported failure

The supplied screenshot shows `/offers` displaying “Choose location” despite a valid Rondebosch `areaId` in the address bar. This supersedes the earlier explanation that the user was viewing the Property category.

Fresh live HTTP reads returned two Shopping specials, two Tourism entries, two Events and two Services for Rondebosch. The place endpoint also returned the expected location. No further database writes are needed for this repair.

The public Cloudflare discovery asset path serves request-independent prerendered shells. Offers and Services previously read their location and category solely from Next router search parameters. The regression tests reproduce an empty router query while the browser address contains the selected location. The screenshot establishes the UI/URL mismatch; its exact runtime cause has not been confirmed by browser instrumentation.

## Change

- Add a shared hydration-safe discovery query hook. Server rendering and initial hydration use router parameters; after hydration the address bar supplies current query state.
- Subscribe to pushState, replaceState, popstate and existing discovery control events. Queue history notifications, preserve history state and restore owned wrappers when subscriptions end.
- Use the hook for Offers (Shopping, Tourism and Events), Services and shared search/filter controls.
- Preserve the existing Property location reader, schemas, APIs, card/map presentation and prerendered asset boundary.

Files: `src/features/discovery/use-discovery-search-params.ts`, its test, `src/features/discovery/url-controls.ts`, `src/app/offers/offers-discovery.tsx`, its test, and `src/app/services/services-url-discovery.tsx`.

## Verification

- 15 tests passed across new query/hydration and route regressions, existing discovery controls and Cloudflare asset routing.
- 43 tests passed across Shopping, Tourism/Event feeds, Services and preserved Property URL/mount behavior.
- `npm run typecheck` passed.
- ESLint passed for all six repair source/test files.
- SSR-to-client regression hydrated a query-free shell into the selected location without recoverable hydration errors.

The user subsequently authorized deployment and one focused live browser check. A production build and Worker size check passed, then the repair was deployed with the existing bindings preserved. The single browser session verified two demo cards per category, retained Rondebosch through category navigation, and checked the Event labels. The demo importer was not rerun and no database records were modified by this release.
