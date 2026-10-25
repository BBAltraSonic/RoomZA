# Services and Specials discovery sheets

Implemented locally on 14 October 2026. No deployment or database changes.

## Behavior

- Services, Shopping, Places and Events use Property's shared mobile results sheet. Peek, Browse and Full List preserve its drag, scrolling, keyboard, reduced-motion and safe-area behavior.
- Search is docked to the results sheet. Search focus promotes Peek to Browse without lowering Full List.
- Snap positions are persisted per category under `pinpoint:discovery-sheet:<category>`; unavailable storage is tolerated.
- Details open within the map pane below navigation, with the same contained geometry as Property. They retain existing category content, galleries, contacts, save actions and URL detail selection.
- Detail dismissal returns to Browse and restores result scroll and opener focus. No modal backdrop or focus trap prevents access to discovery navigation. Nested dialogs own Escape while open.
- Failed refreshes preserve existing public results. Specials' expiry deadlines survive retries; expired snapshots are removed even if the refresh fails.
- Desktop rail widths and map behavior remain intact. Mobile map fitting and the Special marker legend account for the sheet's visible height.

## Verification boundaries

- 69 tests passed across 10 focused files, including all three sheet positions, search docking, per-category persistence, mobile and desktop detail flows, focus and scroll restoration, URL history, gallery controls and retained expiry deadlines.
- Full workspace TypeScript check passed (`tsc --noEmit --incremental false`). ESLint passed for every changed TypeScript/TSX file. `git diff --check` passed.
- 55 fixture browser checks passed with no page errors: opening and closing all four category details, gallery navigation, focus and scroll restoration, failed-refresh recovery, empty results, direct links and browser Back/Forward.
- All four categories were captured at 320, 390, 768, 1024 and 1440px in light and dark themes with no horizontal page overflow. Representative mobile, detail, desktop and failure-state screenshots were visually inspected.
- Browser checks used reduced motion. Sheet gesture and arrow-key behavior and spring configuration are covered by the shared sheet's interaction tests; physical-device keyboard and touch behavior remain unverified.

Browser checks use the real local Next.js routes and components, with a temporary map key, blank fixture map style and intercepted public API responses. The fixtures exercise UI behavior without inserting listings or changing accounts. Development media placeholders and existing image-loader warnings are not evidence of real photo delivery.

No live MapTiler key is configured in the local environment. Production map rendering, production data delivery, real-device keyboard behavior and authenticated save journeys are unverified. The local dev server's temporary key is not written to configuration.

Test and browser evidence is retained under `.cache/discovery-sheet-*.log` and `.cache/discovery-sheets/`. These local artifacts are ignored by Git.
