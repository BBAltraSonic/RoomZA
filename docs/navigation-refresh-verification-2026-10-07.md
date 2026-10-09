# Shared Pinpoint navigation verification

Date: 7 October 2026 (SAST). Implementation and source verification are complete locally. Visual and deployed verification remain pending.

## Result

- The former authenticated Rent/Buy/search header, separate public header and floating account control were replaced with shared Pinpoint chrome.
- Discovery retains location, search, category links, result counts, Feed/Map, sorting, filters and intake controls.
- Workspace/public pages use current Pinpoint branding with existing role/public destinations. Signed-in users retain notifications and account access; landlords retain Add listing.
- A standalone account context prevents navigation/header import cycles. The root account hook, presence heartbeat, motion provider, toast host and server authorization were not edited.
- Centralized route classification covers ordinary pages and nested Profile, Settings and poster routes. Discovery, admin and focused workflows retain ownership of their existing specialized layouts.
- Workspace desktop navigation and bottom tabs now meet at 1024px. Desktop content no longer reserves the bottom-tab offset. Admin keeps its 768px breakpoint.
- Admin/sidebar/tab and existing authentication brand surfaces use shared navigation styling. Content containers, editor back links and conversation controls remain in place.

## Source evidence

| Check | Result |
| --- | --- |
| Focused navigation, account, admin and discovery suites | 126/126 tests passed in 12 files |
| Entry public screens and root-page composition | 8/8 tests passed in 2 files |
| Total focused source tests | 134/134 passed in 14 files |
| npm.cmd run typecheck | Passed |
| ESLint on all 20 changed TypeScript/TSX files | Passed, zero errors and warnings |
| git diff --check on tracked changed files | Passed |
| React component checklist | Account context has no imports from rendering components; no new data requests or libraries; links/buttons retain accessible names, active state and focus behavior |

Raw results are in `artifacts/navigation-refresh-20261007/tests.json`, `additional-tests.json` and `lint.json`. Initial failures were a new badge-query whitespace assumption and TypeScript discovering saved preservation source copies. The query was corrected; saved TypeScript copies use `.snapshot` extensions to keep them out of compilation. The subsequent checks passed.

These tests validate component composition and behavior under jsdom/server rendering. They do not prove CSS layout, a real sign-in journey, map availability or a deployed release.

## Prepared visual checks (not executed)

For each representative surface below, inspect widths **320, 390, 768, 1024 and 1440px**, in **light and dark** themes. Use already-authorized local fixtures/accounts; preserve all existing data.

| Surface | Representative routes | Acceptance |
| --- | --- | --- |
| Discovery | /, /offers, /services | Exactly one owning discovery header; location, category, search, view and intake controls remain usable; Property query state survives navigation |
| Renter workspace | /saved, /applications, /messages, /profile/notifications, /settings/privacy | Current brand and a single account trigger; role destinations and notifications reachable; bottom tabs below 1024px, desktop links from 1024px |
| Landlord workspace | /dashboard, /dashboard/applicants, /dashboard/viewings | Existing destinations/active state; Add listing visible; no Rent/Buy/search row |
| Poster workspace | /post/offers, /post/entries/tourism, /post/services | Shared header and account access above unchanged private workspace content |
| Public | /blog, /trust, /privacy | Existing public destinations reachable, including narrow screens; guest account link returns to current URL after sign-in |
| Admin | /admin, /admin/users | Existing sidebar/mobile structure and owner-only visibility; 768px boundary; current brand and navigation palette |
| Focused | /auth, /auth/reset-password, /auth/verify-email, /dashboard/listings/new, /messages/<id>, /listing/<id> | Existing task layout/back links retained; no added global navigation; current branding wherever already present |

Across every check: no horizontal overflow, obscured content or account menu clipping; keyboard opening/closing and focus restoration; adequate coarse-pointer targets; correct bottom safe-area padding; no overlapping workspace and admin tabs.

The browser cap is unchanged. [The current project instruction](pinpoint-phase5-browser-scope-2026-10-06.md) states: “Do not launch the driver, Playwright, Chromium, a different browser or any substitute UI rehearsal until BB extends the cap.” No browser, substitute UI rehearsal or new approval request was launched for this change.

## Preservation and release boundary

Before-edit copies and hashes are retained in `artifacts/navigation-refresh-20261007/before/` and `baseline.json`; final changed-file hashes are in `verification.json`. Existing uncommitted work was preserved without reset/stash. No database, migration, backend API, route URL, credential or deployment changes were made.

Property direct links, `listingId`, saved-home routes, rent/buy/filter state and map cards retain their implementation; relevant source regressions passed. Visual checks, a production build and deployment were not executed. Deploying this update remains a separate step.
