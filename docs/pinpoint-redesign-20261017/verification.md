# Pinpoint application-wide redesign: verification

17 October 2026. The user approved the representative review set and authorized the remaining application pass. Nothing was deployed.

## Implementation

The shared charcoal/amber system now governs access screens, saved content, messaging/call chrome, applications, purchases, viewings, listing workspaces/editors, profile/settings/notifications, administration, public pages, route states, and browser/app branding. All five discovery categories retain their data and URL contracts.

Notable changes in this pass:

- Explicit amber selections replace primary-action aliases in filters, amenities, saved details, calendars, account navigation, notifications, and journey indicators.
- Account shortcuts include My listings and Settings on mobile. Protected actions keep the existing sign-in return paths.
- Inbox space respects the mobile tabs and safe area. Its fully covered discovery map was removed, eliminating unnecessary map/feed work.
- Listing identity and provider fields precede optional media. Existing fieldsets, consent, required fields, version checks, save/submit/withdraw actions, and publication rules remain.
- Shared controls preserve comfortable tablet sizing. Admin records remain dense with contained, keyboard-scrollable tables and wrapping filters.
- Viewing calendars load when their dialog opens. This brought the conversation route back within the existing JavaScript budget.
- The existing vector mark generates the updated SVG, PNG, Apple touch, and ICO assets. Browser metadata and the app manifest use the approved branding.

`route-inventory.json` records 122 routes, layouts, and route states. This is source coverage, not a claim that every protected page was visited in a browser. `source-manifest.json` records the owned runtime changes. `snapshot-check.json` compares all 691 runtime source files with the isolated build; the final snapshot has no source drift. Existing uncommitted work was retained.

## Functional checks

| Check | Result |
| --- | --- |
| Broad scoped Vitest run | 202 suites, 1,254 tests; 1,252 passed, two timing assertions needed correction |
| Corrected relationship/purchase recovery tests | 2 suites, 11 tests passed; assertions now await settled pending state |
| Auth form and email-verification tests | 2 suites, 11 tests passed |
| Floating details, selected cards, filters, category behavior | Obsolete geometry/color assertions updated and affected suites rechecked |
| Lazy calendar, booking, proposal state retention | Passed, including network recovery and locked pending edits |
| TypeScript | Passed in the final production build; workspace no-emit check also passed |
| Changed-file ESLint and whitespace checks | Passed |
| Production build | Passed, isolated webpack build |
| First-load client budget | Passed for 95 routes, 1300 KB limit |
| Root discovery initial bundle | 295.7 KB compressed, 300 KB limit |

The initial visual assertion compared source spelling of OKLCH values with minified CSS spelling. It now compares the numeric color components. The mobile screenshot fixture now waits for hydration and loaded results before opening Browse. One PNG baseline could not be overwritten in place because Windows had it mapped; its visually reviewed actual capture was accepted by atomic replacement, then compared successfully. Test hooks and assertions were corrected without weakening runtime safeguards. Existing Next middleware/Edge-runtime notices remain.

The final fixture build uses an inert MapTiler key in its process environment so the map component can initialize against intercepted map responses. Workspace environment files and deployment configuration were not changed. The earlier successful build without a map key also passed the build/bundle checks and showed the intended missing-configuration state.

## Visual and browser evidence

| Coverage | Evidence |
| --- | --- |
| Private components and workflows | 168 component/theme/layout checks from actual component renders with fixture data |
| Public pages | 80 actual local production route/theme/viewport checks |
| Protected destinations | 7 guest redirects checked, including Saved, Create, My listings, Messages, Profile, Settings, Admin |
| Sign-in form | Account mode, password reveal, required confirmation field, and retained return destination exercised without submitting |
| Gallery | 88 screenshot combinations loaded, gallery checked at five widths |
| Discovery and first review | See the preserved 16 October gallery and 121 fixture/component checks |
| Playwright visual baselines | 18 scenarios verified: 17 passed together, then the remaining refreshed sign-in baseline passed its focused comparison |

Widths: 320, 390, 768, 1024, 1440px. Private component checks also cover 390×540 short screens. The table fixture verifies keyboard scrolling. Browser matrices use reduced motion. Normal-motion discovery opening/dismissal and nested Escape behavior were checked in the first review set. Missing imagery, empty/error/loading feedback, long descriptions, and retained draft state are covered by the fixture/component tests and first-review evidence.

The gallery distinguishes actual public pages from static private previews. Static renders do not hydrate private components or execute their mutations; they are visual/layout evidence only. Public pages recorded no uncaught page errors and no horizontal page overflow. Horizontal scrolling inside a navigation strip or records table is intentional.

## Remaining real-world verification

- Live MapTiler geography and live discovery data are not proven by intercepted fixture maps. The earlier unmocked local discovery check reported a missing property-contact RPC; no database repair was made in this redesign.
- Real authenticated creation, document/application transactions, two-account messaging, private notifications, and actual call sessions remain unverified in a browser.
- Physical-device keyboards, notches, touch behavior, Safari, and installed-app icon refresh remain unverified. Desktop Chromium emulation is not real-device evidence.
- No deployment, database/schema/API/permission change, external email redesign, or external message was performed.

The source, gallery, and checks are ready for review. These local results do not establish production readiness of the existing backend or authenticated workflows.
