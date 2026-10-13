# Specials reference correction release

Deployed 9 October 2026 to https://roomza.pinpoint-roomza.workers.dev at 100% traffic.

- Worker version: 47ca9db3-9ae2-4f20-b502-0bef475d02f8
- Deployment: f00cab1e-0fff-42a8-86f6-0d0f2921af14
- Previous release / rollback candidate: b94188ba-9263-4880-bb75-2c736496e1f5
- No database migration, production fixtures, uploads, saves or price changes.

## Visible correction

Specials use compact cream cards with a short identity row, bold two-line title, optional uploaded banner, lime price badge, calculated discount and a small countdown/progress bar. Long descriptions remain on canonical detail pages. The expanded card has an amber identity header or uploaded banner, close control, and a footer outside its scrolling body so Directions, save and share stay visible. Valid contact actions remain accessible under Contact venue. Pins use a cream surface with urgency rings and a forest selected state. On narrow screens the selected card is centred at the top of the map. Only Specials opt into the compact results rail.

Property and Services runtime sources match the deployed baseline. The isolated snapshot overlays exactly ten scoped source/test files and preserves 1190 baseline source files. Existing dirty work, guest-contact changes and unrelated Property/mobile changes were excluded. No pending SQL was applied.

Production demo items currently lack structured prices and uploaded photos. No prices or photos were invented; the lime badge and photo appear when supplied and approved through the existing workflow. Screenshots below use readonly local test data, including a synthetic banner and saved-count fixture; these are not production content.

## Verification

- 332 tests / 47 suites; typecheck, targeted lint, production/OpenNext build and existing initial JavaScript budgets passed.
- Existing Worker size gate: 3064.4 KiB gzip against 3072.0 KiB. Standard generated-server minification preserved function and class names.
- Live read-only checks: 35 routes/APIs and 44 served asset hashes passed. Confirmed served card, legend, upload, review and saved markers; Property rent/buy, all category viewports, private saved caching and guest media denial.
- Cloudflare accepted the Worker at 45 ms startup; compatibility date, nodejs_compat and all eight binding names/types were preserved with --keep-vars.
- Exactly one authorized headed Chromium attempt was consumed and closed. Twelve valid local visual scenarios passed: light/dark at 320, 390, 768 and 1440 px, banner and failed-banner at 320/1440. All captured layouts fit their map bounds and exposed the actions; no page errors, no horizontal document overflow, close cleared selection.
- The two long-title screenshots did not exercise long titles because the fixture exceeded the 160-character contract; refresh retained the previous card. These remain pending, despite passing geometry assertions. browser-audit.json corrects the original driver report. No additional browser run was started. Production verification was HTTP/hash based; the browser run used the isolated local app with intercepted readonly fixtures.

## Evidence and rollback

release.json records the immutable snapshot and hashes; preservation.json records scope; smoke.json records live evidence. browser.json is the raw driver report, browser-audit.json records its verification limitation, and browser-authorization.json records the consumed attempt and driver hash. Screenshots are in browser/. Test driver remains in Temp as required by the Playwright skill.

For an explicitly authorized rollback: npx wrangler rollback b94188ba-9263-4880-bb75-2c736496e1f5 --message=rollback-specials-reference-fix-20261009 . This UI correction has no database changes.

Scoped source artifact: [ZIP](C:/Users/BB/Documents/RoomZA/artifacts/discovery-cards/specials-reference-fix-deployed-20261009.zip).
