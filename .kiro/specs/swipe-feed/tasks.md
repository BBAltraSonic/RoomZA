# Tasks — Swipe Feed

Test first for each task: write the failing test, make it pass, refactor.

## Phase 1a — Foundations (no visible change)

- [x] 1. Extract structured detail cards from `listing-detail-panel.tsx` into
      `src/features/listings/detail-cards/` with their tests; the old panel imports them.
- [x] 2. `feed-queue.ts` reducer + tests (Design: Feed_Queue state).
- [x] 3. `session-passes.ts` and `guest-saves.ts` + tests (merge on sign-in).
- [x] 4. `resolveSwipe` + `use-swipe-gesture.ts` on pointer events; threshold tests.
- [x] 5. `media-kind.ts` (photos / none) + tests.
- [x] 6. `SWIPE_FEED` flag helpers and `?feed=1` preview. Layout wiring moves to task 11.

## Phase 1b — Homes Feed (photos)

- [x] 7. `PhotoStage` (tap-third stepping, ticks, prefetch next two) + render tests.
- [x] 8. `FeedCard` (overlay facts, Detail_Sections, static location map, sticky CTA_Bar,
      swipe off when scrolled) + render tests.
- [x] 9. `DecisionBar` (✕ / Undo / ♡) + render tests.
- [x] 10. `FeedView` (chips row, Map/Feed toggle, three mounted cards, end state, empty
      state, keyboard, polite announcements, reduced motion).
- [x] 11. Wire into `DiscoveryWorkspace` / `discovery-page.tsx`: `view` param, `listingId`
      cursor via `replace`, pin and card taps open the Feed, dim passed pins, desktop map
      follows cursor.
- [x] 12. `/listing/[id]` renders the Feed at that listing; keep metadata, view tracking,
      `intent=apply|message`. A gone listing says so and the Feed continues (8.3).
- [x] 13. Playwright flows (phone + desktop) and size gate with flag on.
      `e2e/swipe-feed.spec.ts` runs when the server has `SWIPE_FEED=on` or `preview`; the build
      needs `NEXT_PUBLIC_MAPTILER_API_KEY` set (any value, the spec stubs the style) or no results load.
- [ ] 14. Staging with `preview`, then `on`.

## Phase 1c — Retire the old detail view

- [ ] 15. Delete `ListingDetailPanel`, floating detail surfaces and their branches/tests.
- [ ] 16. Update `PRODUCT.md` ("Map is always one tap away") and `DESIGN.md`.

## Phase 1d — Specials on the Feed

- [ ] 17. Map shopping / places / events detail content onto `FeedCard` sections
      (reuse `special-detail-content.tsx` data), chips from `section-quick-chips.tsx`.
- [ ] 18. Retire the specials floating detail surface.

## Phase 2 — Video

- [ ] 19. Decide hosting (Cloudflare Stream vs R2 MP4 + poster); write the migration and RLS
      (ask before migrating the dev DB).
- [ ] 20. Lister upload (limits, MIME check, poster, transcode status).
- [ ] 21. `VideoStage` with autoplay rules (on screen, not save-data, setting on) + tests.

## Phase 3 — PDF leaflets (Specials)

- [ ] 22. Leaflet upload, storage and RLS; worker renders page images at upload.
- [ ] 23. `LeafletStage` (PhotoStage + "Open leaflet") + tests.
