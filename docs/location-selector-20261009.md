# Location selector suggestions, 9 October 2026

The shared discovery chooser retains its plain black text, left location icon and dropdown chevron. Opening it displays actual catalogue suggestions and recent choices. Typed queries match suburb/name and region words, prioritize exact and prefix name matches, and highlight the matching text. Arrow keys and Enter select suggestions; Escape closes and restores focus. Retry, clear search, clear history and empty states are available.

Discovery uses the new `/api/discovery/places` endpoint. It reads `discovery_places` with the public Supabase key and existing read policies, validates returned UUIDs and bounds, limits queries/results, and rate-limits requests. There are no Google/MapTiler geocoding calls, external autocomplete fees, database writes or new dependencies in this search path. Existing database and hosting usage still applies.

Device history contains at most five validated place IDs under `pinpoint:recent-location-ids:v1`. The server resolves current records when reopening; missing records are omitted. Suggestions and typed searches are cached in the chooser for five minutes with a twenty-entry limit. Stale requests are aborted/ignored. Private intake search endpoints retain their existing authentication and do not use discovery browsing/history.

Scope: shared selector and its tests; a new catalogue contract, read module and tests; a new route and tests; one selector prop removed from each of the existing viewport and entry public feed callers. Pre-existing changes in those callers remain in place. No deployment, migrations, catalogue imports or other production mutations were performed.

Verification:

- Focused selector/catalogue/API and compatibility tests passed; TypeScript and scoped ESLint passed.
- Broader header, viewport and entry tests passed. One Services test expects `/post/services` while the current guest header links to `/auth?redirect=%2Fpost%2Fservices`. That test mocks LocationSelector, so the failed assertion is outside this implementation.
- Production catalogue was queried read-only using `.env.production.local`: five records returned by browsing. `Ronde` returned three records; `Cape Town` returned four. `Western Cape` returned zero because current stored region labels do not include it. These are catalogue places, not claims about published listing inventory.
- Local database is unavailable at `127.0.0.1:54321`. Production reads verified actual catalogue query execution; source tests cover interaction logic. Browser/responsive visual verification remains pending under the existing browser-attempt cap.

Coverage is currently limited to those stored records. Wider South African coverage requires a separately scoped catalogue import or enrichment; this change does not invent locations or add approximate map bounds.
