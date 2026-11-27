# Design Document — Swipe Feed

See `requirements.md` for the settled decisions. This document says where the Feed lives,
how its state works, and how it replaces the current detail view.

## Where it plugs in today

| Today | Role | What changes |
| --- | --- | --- |
| `src/app/(discovery)/layout.tsx` → `DiscoveryWorkspace` | Keeps the map mounted across `/` and `/offers` | Also mounts Feed_View, so toggling never remounts the map |
| `src/features/map-discovery/discovery-page.tsx` (1,883 lines) | Map, search, sheet, selection, detail panel | Gains a `view` switch and hands the Feed its queue. No Feed logic is added here |
| `mobile/bottom-sheet.tsx`, `listing-carousel.tsx`, `listing-grid.tsx` | Phone results | Stay for Map_View. Tapping a card opens the Feed instead of the detail panel |
| `listing-detail-panel.tsx` (1,214 lines) | Detail view | Its structured cards move out; the panel is deleted when the flag is fully on |
| `src/app/listing/[id]/page.tsx` | Deep link | Renders the Feed opened at that listing; metadata and tracking unchanged |
| `hooks/use-favorites.ts` | Favourites store (signed-in only today) | Gains a guest layer for Save |
| `section-quick-chips.tsx`, `lib/quick-filters.ts` | Chips | Reused unchanged in Feed_View |

## New module: `src/features/swipe-feed/`

```
swipe-feed/
  feed-view.tsx            Feed_View: chips row, card stack, Decision_Bar, end state
  feed-card.tsx            One listing: scroll container, Media_Stage, Detail_Sections, CTA_Bar
  media-stage.tsx          Chooses PhotoStage | VideoStage | LeafletStage from media kind
  photo-stage.tsx          Tap-third stepping, progress ticks
  decision-bar.tsx         ✕ / Undo / ♡ buttons
  swipe-physics.ts         Pure: commit threshold, axis lock, velocity, tilt and stamps
  use-swipe-gesture.ts     Pointer events: drag, tap, fly-out, spring back
  feed-queue.ts            Pure reducer: queue, cursor, passes, history (undo)
  browser-storage.ts       Web Storage access that never throws
  session-passes.ts        sessionStorage read/write of passed ids
  guest-saves.ts           localStorage saves for guests, merge on sign-in
  media-kind.ts            Pure: listing media → "photos" | "none" (video, leaflet later)
  feature-flag.ts          SWIPE_FEED modes; feature-flag.server.ts reads the env
  feed-keyboard.ts         Key bindings (Requirement 10.2)
  *.test.ts(x)             Unit and render tests beside each file
```

`src/features/listings/detail-cards/` receives `TrueMonthlyCostCard`, `MoveInCostCard`,
`BondCalculatorCard`, `PurchaseProgressTimeline`, `ListerIdentity` and the amenities block,
extracted from `listing-detail-panel.tsx` with their tests. The Feed and (until removal) the
old panel both import them, so behaviour is identical while the flag is partial.

## Feed_Queue state

The queue is derived, not fetched separately: it is the same `ListingCardModel[]` the map
and sheet already hold for the current viewport, chips, filters and sort.

```ts
type FeedState = {
  order: string[];          // listing ids from the current result set
  cursor: string | null;    // id of the card on screen
  passed: Set<string>;      // this session (Requirement 3.5)
  history: FeedAction[];    // for Undo, last N actions
};
type FeedAction = { type: "pass" | "save"; id: string };
```

- `visible = order.filter(id => !passed.has(id))`; the current card is `cursor` or the first
  visible id.
- `pass(id)` / `save(id)` push to `history` and move `cursor` to the next visible id.
- `undo()` pops `history`, un-passes or un-saves, and sets `cursor` back.
- When `order` changes (chip, filter, map move), keep `cursor` if it is still present,
  otherwise go to the first visible id (Requirement 2.2).
- Opening from a pin or `/listing/[id]` sets `cursor` to that id. If it is not in `order`
  (deep link outside the viewport), it is prepended.
- End of queue → `cursor = null` → end state (Requirement 9).

This reducer is pure and carries most of the unit tests.

## URL

- `view=feed` | `view=map` (existing param; `/offers` already writes `view=map`).
- `listing=<id>` holds the Feed cursor, reusing the param `discovery-page.tsx` already reads
  for deep links. Updates use `router.replace` per card so swiping does not fill history;
  toggling view uses `push`.

## Gestures

Plain pointer events (`use-swipe-gesture.ts`), no new library. Not `motion`'s drag: the
app's `MotionProvider` loads `domMin` under reduced motion, which has no drag, and swiping must
keep working for those visitors. Writing styles straight to the element also means a drag
causes no React renders.

- The **Media_Stage** is the drag handle, with `touch-action: pan-y`: the browser keeps
  vertical scrolling, and the first 8 px of movement lock the axis (`lockAxis`), so a scroll or
  diagonal never becomes a swipe. Detail_Sections are not draggable.
- Commit when `|offset.x| > 0.3 × width`, or on a flick faster than 600 px/s that moved at
  least 24 px in the same direction; otherwise spring back (`resolveSwipe` in
  `swipe-physics.ts`).
- Swipe is disabled while `scrollTop > 0` (Requirement 4.5); taps still work.
- Fly-out animates `transform` only. Reduced motion → opacity fade. ✕ / ♡ buttons and keys
  call the same `flyOut`.
- The stamps read `--swipe-save-opacity` / `--swipe-pass-opacity` from the element.
- The click that ends a drag is swallowed, so it never presses a button inside the card.
- Photo stepping is a tap (under 8 px movement, under 300 ms) reported with its position
  across the card, so it does not fight the drag.

## Layout

- **Phone (< 1024px):** Feed_View fills the screen under the app bar. Top: chips row and the
  Map/Feed toggle. Card: Media_Stage at `100dvh` minus chrome, Detail_Sections below, CTA_Bar
  sticky at the bottom with the Decision_Bar above it on the Media_Stage.
- **Desktop (≥ 1024px):** the results panel area holds the Feed as a phone-proportioned card
  column; the map stays visible beside it and follows the cursor (highlight, pan if the pin
  is off screen). Keyboard shortcuts are shown once in a hint.
- **Location in details:** a static MapTiler image (no second WebGL map) with "Open on map",
  which switches to Map_View centred on the pin.

## Saves for guests

`use-favorites.ts` redirects guests to sign-in today. The Feed wraps it:

- Signed in → existing API path, unchanged.
- Guest → `guest-saves.ts` (localStorage). First guest save shows one toast offering sign-in.
  After sign-in (`NAVIGATION_IDENTITY_EVENT`), local saves are posted to `/api/favorites` and
  cleared. The "favourites" chip includes guest saves.

## Media (phases 2 and 3)

`media-kind.ts` is introduced in phase 1 returning only `"photos"` / `"none"`, so later
phases add a kind without touching `feed-card.tsx`.

- **Video:** new storage path and table columns for one video per listing, server-checked
  MIME and size, a poster frame, and a transcode step. Hosting choice (Cloudflare Stream vs
  R2 MP4 + poster) is decided at the start of phase 2. Autoplay rules in Requirement 6.2;
  `navigator.connection.saveData` matters on South African prepaid data.
- **Leaflets:** PDF stored as-is; page images are rendered at upload in a worker and saved
  beside it, so `LeafletStage` is a `PhotoStage` with an "Open leaflet" action.

Both need migrations and reviewed RLS. Per project practice, ask before migrating the dev DB.

## Feature flag

Server-read env flag `SWIPE_FEED` (`off` | `preview` | `on`, default `off`):
`readSwipeFeedMode()` in `feature-flag.server.ts`, and `isSwipeFeedEnabled(mode, searchParams)`
in `feature-flag.ts` for either side. Wiring it into the discovery layout waits for task 11,
because the unmerged services-removal work also edits `src/app/(discovery)/layout.tsx`.
`preview` enables it only with `?feed=1`, for testing on staging. The Cloudflare deploy needs
the variable set too.
The DB-backed pattern in `features/live-tours/feature-flags.ts` is an alternative if the flag
must change without a deploy.

## Removal (after `on` is stable)

Delete `listing-detail-panel.tsx`, `floating-discovery-detail.tsx`,
`discovery-detail-surface.tsx`, their tests and the `ListingDetailPanel` branches in
`discovery-page.tsx`; update `PRODUCT.md` and `DESIGN.md` (detail panel and map-rule text).

## Testing strategy

- **Unit (Vitest):** `feed-queue` (pass, save, undo, chip change keeps or resets cursor,
  deep-link prepend, end of queue, session passes skipped), `resolveSwipe` thresholds,
  `session-passes`, `guest-saves` merge, `media-kind`, keyboard map.
- **Render (Testing Library):** `FeedCard` (article label, overlay facts, structured
  sections, CTA_Bar actions, swipe disabled when scrolled), `DecisionBar` (names, pressed
  state, Undo), `FeedView` empty and end states, chips filtering.
- **E2E (Playwright, phone and desktop projects):** pin → Feed at that listing; ✕ advances and
  dims the pin; Undo restores; guest ♡ keeps without redirect, merges after sign-in; scroll up
  shows CTAs; Map/Feed toggle keeps viewport; `/listing/[id]` and `intent=apply` still work;
  reduced motion.
- **Budget:** existing first-load JS size gate must pass with the flag on.
