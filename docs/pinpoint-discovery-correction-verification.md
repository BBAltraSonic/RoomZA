# Pinpoint discovery correction and local Services verification

Date: 3 October 2026. This record supersedes the layout/coming-soon status in `pinpoint-redesign-verification.md`. Scope is the existing Pinpoint discovery pages and local-provider Services. No deployment or production build was performed.

## Result

- Property, Specials and Services share the reference header, category actions and place/view navigation. Actions are Add listing, Add special and Add service. Tourism is inside Specials and links to its existing private intake.
- Map shows the results rail and corresponding locations. Feed removes the map. Public approved shopping Specials and local Services supply their own card/pin coordinates; no invented supply or counts are shown.
- Property now uses one header in both views. Phone sheets and details stay inside the map body below the header; filter controls remain clickable over the full sheet. Mobile sorting/filters collapse behind a disclosure. Desktop spacing follows the supplied header reference, which does not specify the body design.
- Property bounds padding uses the actual map container height, so short phone panes retain usable camera space. Existing listing links, saved homes, rent/buy filters and URL handlers remain in place.
- Local Services has private draft/save/reload/submission, explicit permission confirmation, MFA administrator review, approved public snapshots, card/pin discovery, and withdrawal/unpublish. Optimistic versions prevent stale writes/reviews. Editing a published submission leaves the previously approved public snapshot intact until approval; rejecting the edit preserves that snapshot.
- Services writes use the signed-in session and database authorization, with no feature-level service-role mutation. Private submissions and audit events are separate from the public projection.

## Verification

- Full Vitest suite before the final cached-place and camera-height additions: **1,283 passed, 2 skipped**, across 229 passed and 2 skipped files.
- Final focused run after those additions: **234 passed across 53 files**, covering map discovery, Property URL/filter/request behavior, sheet behavior and cached-place search. Includes short-map padding and cached UUID/wildcard/error checks.
- Final TypeScript check passed. Focused ESLint completed with no errors and one existing internal-navigation warning in `map-view.tsx`.
- Real shared-local anonymous browser checks covered one header, correct action destinations, guest sign-in return path, responsive Property containment at 1218/390/320px and filter/full-sheet interaction. Shared Services public reads return an empty feed with `no-store`; no fixture providers/users were added.
- Disposable patched-clone real Auth/MFA/API/SQL and browser checks passed: partial save/reload, private consent/submission, administrator approval, anonymous approved card/pin, withdrawal removal, ownership/write denial, suspended poster hiding, immutable audit events, stale concurrent decisions, rejected edits and unpublish. Captured fixtures and clone resources were removed; the source baseline was preserved.
- Services-specific read-only database advisor checks found no warning/error or unindexed foreign key. Two expected unused-index informational findings were retained. This does not certify unrelated existing schema findings.

## Shared local enablement

The user explicitly approved enabling Services locally. Only migration `20261003081807_pinpoint_local_services.sql` was applied and recorded in migration history. TOTP enrollment/verification was enabled by replacing only the local Auth container with the same image/configuration except those two flags; `supabase/config.toml` was aligned.

Recorded comparisons preserve existing table counts, Property hashes, Auth users/sessions/factors, schedules and all other container identities. The three new Services tables are empty. Other pending migrations were not applied and the database was not reset.

## Evidence and practical limits

- `pinpoint-services-local-evidence.json`: successful clone domain and browser results. Its older short check string says “substituted basemap style only”; the precise boundary is **both blank MapTiler style and place-search suggestions were substituted**. Suggestions referred to a real stored clone place; service authentication, API writes, SQL persistence, review and public reads were real. MapLibre rendering, worker, actual fixture coordinates, marker selection and camera behavior were exercised. Live MapTiler tiles/geocoding were not verified.
- `pinpoint-services-shared-local-evidence.json`: authorized shared migration/Auth enablement and before/after preservation.
- `pinpoint-services-shared-browser-evidence.json`: read-only shared-local smoke. Its synthetic query UUID creates no place or service fixture.
- `pinpoint-property-correction-browser-evidence.json`: actual shared Property containment and filter checks.
- `pinpoint-services-advisors-evidence.json`: bounded Services advisor findings.
- `pinpoint-correction-property-desktop.png` and `pinpoint-correction-property-phone.png`: actual shared-local screenshots with the existing missing-map-key fallback.
- `pinpoint-services-map-desktop.png` and `pinpoint-services-map-phone.png`: populated synthetic clone provider with the substituted blank basemap; these are not real public supply.

The user chose to keep the current map setup. There is no development MapTiler key and the shared `discovery_places` catalogue is empty. Cached-place fallback is implemented and unit-tested, but this shared app currently has no cached places to select; adding locations and live map verification require a development key. No key or real supply was fabricated.

Tourism remains under Specials with its existing private intake/corrections and an explicit coming-soon public state. Its approval/public projection is unfinished. This work does not complete the entire Pinpoint Pivot plan or change its wider release acceptance totals.

The opt-in `scripts/db/services-discovery.local.mjs`, `services-discovery-check.local.mjs` and `services-discovery-browser.local.cjs` retain the guarded disposable-clone harness. Final harness packaging/compatibility edits were syntax-checked after the successful clone run; the unchanged domain journey was not repeated solely for packaging. `enable-services.local.mjs` is the already-executed one-time shared enablement helper and deliberately refuses an existing Services schema.
