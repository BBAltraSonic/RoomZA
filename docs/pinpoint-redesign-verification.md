# Pinpoint reference-header redesign verification

Historical first-pass record. Current layout, category Map/Feed behavior and local Services status are documented in [the correction verification](pinpoint-discovery-correction-verification.md).

Date: 3 October 2026. Scope: apply the supplied navigation reference to existing Pinpoint discovery, not a separate preview route.

## Implemented

- Shared `src/components/navigation/pinpoint-header.tsx` and scoped CSS module: cream light header, forest controls, lime count accent, singular Pinpoint brand, tagline, location, category search, Feed/Map, saved homes, notifications, listing intake and compact account menu.
- Property desktop discovery and phone Feed use the shared header. Rent/buy, filters, saved homes, listing details and URL handlers retain their existing implementation. The phone Map retains its map controls, adds category/account navigation, and moves search below the category row.
- Specials reuses the existing public feed and refresh/expiry handling. Search, Ending soon, Latest and Nearest operate on the current page. Nearest uses the selected place centre. Pagination scope is disclosed.
- Category links carry the selected place. The active Property link retains the complete query. Badges display only successful loaded counts for the current category; the image's sample counts are not fabricated.
- Compact account menus retain renter/landlord workspace destinations, keyboard navigation, Escape and focus restoration. Existing workspace headers remain in place outside discovery.
- `/services` is an explicit coming-soon screen. Specials/Services Map is disabled with a title explaining that Map discovery is currently available in Property.
- DESIGN.md records the reference's scoped cream-header exception and responsive behavior.

## Verified

- `npm.cmd run typecheck`: passed.
- ESLint on the changed TSX files: passed.
- Seven focused Vitest files: 63 tests passed. Includes existing navigation, location selection, Property URL/filter/detail regressions, feed area/error/late-response behavior, plus new Specials sorting/search/count and compact workspace-navigation checks.
- Local anonymous Chromium at `http://localhost:3000`: Property Feed, Specials and Services at 1218px and 375px. One visible header per screen, active category, location disclosure, account keyboard opening, Escape and focus restoration passed.
- Specials at 1024px, 768px and 320px: no horizontal overflow. Dark-theme header passed. No browser page errors in the recorded route checks.
- Phone Property Feed-to-Map switch retained `mode=buy` and `beds=2`. Category navigation ended at y=114px and search began at y=128px, without overlap. This proves chrome and URL behavior, not MapTiler tile availability.
- Raw browser results: `artifacts/pinpoint-redesign-browser-evidence.json`.
- Desktop, phone and header screenshots: `artifacts/pinpoint-redesign-*.png`.

## Evidence boundaries

Browser screenshots show the actual local location-selection/coming-soon screens. Offer sorting/search uses explicit unit-test fixtures; this is not a populated real-database offer journey. The browser checks do not establish publication, intake, redemption, directions delivery or signed-in backend behavior. Existing data, migrations and prior uncommitted work were preserved. No database fixtures, resets, deployments or external messages were performed. Production build/deployment was not run.

During verification, an edit-generated non-UTF-8 apostrophe was corrected and both edited discovery/feed sources were validated as UTF-8. Initial browser attempts captured the entrance animation or acted before hydration settled; final checks wait for page readiness and exercise the live controls.
