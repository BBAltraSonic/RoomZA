# Requirements Document — Swipe Feed

## Introduction

Discovery gets a second way to browse: a **Feed** next to the **Map**. The Feed shows one
listing at a time, full-screen on a phone. The visitor passes with ✕ or saves with ♡ (by
button or by swiping the card left or right), and either action moves to the next listing.
Scrolling up on a listing reveals its details and calls to action, the way a Tinder profile
opens when you swipe up.

The Feed **replaces the current listing detail view** (`ListingDetailPanel`, the floating
detail surfaces and the `/listing/[id]` detail layout), including when a listing is opened
from a map pin. Every listing is entered the same way: as a vertically scrollable Feed card.

Media decides how the top of a card looks:

- **Photos** — tap-to-step gallery (phase 1).
- **Video** — vertical, TikTok-style autoplay (phase 2).
- **PDF** — e.g. a specials leaflet, shown as page images (phase 3).

Homes ship first, then Specials (shopping, places, events) reuse the same Feed.

### Decisions (settled 2026-11-27)

| Topic | Decision |
| --- | --- |
| Map rule | On phones the Feed may fill the screen. The map is always **one tap away** (Map/Feed toggle) and each card's details show the listing's location. Desktop keeps the map beside the Feed. `PRODUCT.md` changes "Map never disappears" to "Map is always one tap away". |
| ✕ meaning | **Skip for this session only.** Passed listings return on the next visit. Undo restores the last pass. |
| Media order | Photos first (phase 1), video next (phase 2), PDF leaflets after (phase 3). |
| Rollout | Homes on mobile and desktop first, behind a flag, replacing the detail panel. Specials follow on the same Feed. |

## Glossary

- **Map_View**: the existing map-first discovery screen.
- **Feed_View**: the new one-listing-at-a-time screen.
- **View_Toggle**: the control that switches between Map_View and Feed_View.
- **Feed_Queue**: the ordered listings the Feed walks through. It is the same result set the
  map is showing (viewport, area, chips, filters, sort).
- **Feed_Card**: one listing in the Feed. A vertical scroll container with a **Media_Stage**
  on top and **Detail_Sections** below.
- **Decision_Bar**: the ✕ and ♡ buttons (plus Undo).
- **CTA_Bar**: the listing's actions (Message, Book viewing, Apply / Make offer).
- **Pass**: ✕. Hides a listing from the Feed_Queue for the current browser session.
- **Save**: ♡. Adds a listing to favourites.
- **Quick_Chips**: the existing quick filter chips (`QUICK_FILTER_KEYS`, section chips).

## Requirements

### Requirement 1: Map and Feed views

**User Story:** As a visitor, I want to switch between a map and a feed of the same results,
so that I can browse by place or by listing.

1. THE discovery screen SHALL offer a View_Toggle with two options, Map and Feed.
2. WHEN the visitor switches view, THE Feed_Queue and the Map_View SHALL keep the same area,
   Quick_Chips, filters and sort.
3. THE current view SHALL be stored in the URL (`view=feed` / `view=map`) so that back,
   forward, refresh and shared links restore it.
4. WHEN the visitor returns from Feed_View to Map_View, THE map SHALL show the same viewport
   it had, with the last Feed_Card's pin highlighted.
5. WHERE the viewport width is 1024px or greater, THE Feed_View SHALL sit beside the map
   instead of covering it, and the map pin for the current Feed_Card SHALL be highlighted.

### Requirement 2: Chips filter the Feed

1. THE Quick_Chips SHALL be visible at the top of Feed_View and SHALL filter the Feed_Queue.
2. WHEN a chip changes, THE Feed SHALL restart at the first matching listing, keeping session
   Passes hidden.
3. IF no listing matches, THEN THE Feed SHALL show the existing quick-filter empty state with
   actions to clear chips or widen the area.

### Requirement 3: Pass and Save

**User Story:** As a visitor, I want to dismiss or keep a listing with one gesture, so that I
can get through many listings quickly.

1. THE Decision_Bar SHALL show a ✕ button (accessible name "Pass") and a ♡ button
   (accessible name "Save", pressed state when saved).
2. WHEN the visitor drags the Media_Stage horizontally past 30% of its width, or flicks it
   faster than the velocity threshold, THE card SHALL fly out: left = Pass, right = Save.
   A shorter drag SHALL spring the card back with no action.
3. WHILE the drag is in progress, THE card SHALL show a ✕ or ♡ stamp whose opacity follows the
   drag distance.
4. AFTER a Pass or Save, THE Feed SHALL show the next listing in the Feed_Queue.
5. A Pass SHALL hide the listing from the Feed_Queue for the current browser session only
   (sessionStorage). It SHALL reappear in a new session. Map pins and result cards (the mobile
   sheet and the desktop list) for passed listings SHALL be dimmed and announced as passed,
   not removed.
6. THE Decision_Bar SHALL offer Undo for the most recent Pass or Save, which returns that
   listing to the front of the Feed (and removes a Save).
7. WHEN a signed-in visitor saves, THE listing SHALL be added through the existing favourites
   API. WHEN a guest saves, THE listing SHALL be kept locally, a single non-blocking prompt
   SHALL offer sign-in, and local saves SHALL merge into favourites after sign-in. Saving
   SHALL NOT redirect a guest to sign-in.
8. IF a Save fails, THEN THE card SHALL stay saved locally and a toast SHALL offer retry.

### Requirement 4: Scroll up for details

**User Story:** As a visitor, I want to scroll up on a listing to see its details and act on
it, so that I never leave the Feed to learn more.

1. EACH Feed_Card SHALL be a vertical scroll container: Media_Stage first (fills the card),
   then Detail_Sections.
2. THE Media_Stage SHALL overlay the title, price, area and one-line key facts, with a cue
   that more is below.
3. THE Detail_Sections SHALL use structured blocks, not long prose (`PRODUCT.md`): key facts,
   true monthly cost, move-in cost, bond calculator (sale listings), amenities, location
   (static map image with "Open on map"), lister identity and trust, a live tour in progress or
   the next scheduled one, recent activity, and a description capped at a short expandable
   excerpt.
4. THE CTA_Bar SHALL stay pinned to the bottom of the card while details are visible and SHALL
   reuse the current actions (message, viewing, apply / offer, share, more menu).
5. WHILE the card is scrolled away from the top, horizontal swipe SHALL be disabled so reading
   never triggers a Pass or Save; the ✕ / ♡ buttons SHALL stay available.
6. WHEN the visitor moves to the next listing, THE new card SHALL start at the top.

### Requirement 5: Media stage — photos (phase 1)

1. Tapping the right or left third of the Media_Stage SHALL step to the next or previous photo.
   Progress ticks SHALL show the position.
2. THE first photo of the next two Feed_Cards SHALL be prefetched.
3. A listing with no photos SHALL show the existing photo placeholder.

### Requirement 6: Media stage — video (phase 2)

1. Listers SHALL be able to upload one vertical video per listing (limits set in design).
2. A video SHALL autoplay muted only when the card is on screen, AND the connection is not
   marked save-data, AND the visitor has not turned autoplay off. Otherwise a poster with a
   play button SHALL show.
3. Tap SHALL pause / play; the photo stepper SHALL move to after the video.

### Requirement 7: Media stage — PDF leaflets (phase 3)

1. Listers of Specials SHALL be able to attach a PDF leaflet.
2. Page images SHALL be generated at upload, so the Feed shows pages like photos and ships no
   PDF viewer in the client bundle. An "Open leaflet" action SHALL open the original PDF.

### Requirement 8: Entering a listing

1. WHEN the visitor taps a map pin or a result card, THE Feed_View SHALL open at that listing,
   with the rest of the Feed_Queue after it.
2. `/listing/[id]` SHALL render the Feed_View opened at that listing, keeping its current
   metadata, view tracking and `intent=apply|message` behaviour.
3. IF the listing is unavailable, THEN THE Feed SHALL say so and continue with the area's
   Feed_Queue.
4. AFTER the flag is fully on, `ListingDetailPanel` and the floating detail surfaces SHALL be
   removed.

### Requirement 9: End of the Feed

1. WHEN the Feed_Queue runs out, THE Feed SHALL say so and offer: widen the area, clear chips,
   show passed listings again, or back to the map.

### Requirement 10: Accessibility and motion

1. Every gesture SHALL have a button equivalent.
2. Keyboard: ← Pass, → Save, Z Undo, ↑ / ↓ scroll details, M toggle Map/Feed.
3. Each Feed_Card SHALL be an `article` labelled by its title; moving to the next card SHALL be
   announced politely.
4. WITH `prefers-reduced-motion: reduce`, cards SHALL cross-fade instead of flying out.

### Requirement 11: Performance

1. The Feed SHALL load as its own chunk and SHALL NOT raise the first-load JS budget
   (1330 KB). Removing `ListingDetailPanel` should offset it.
2. At most three Feed_Cards (previous, current, next) SHALL be mounted.
3. Swipe animation SHALL use transforms only and hold 60 fps on a mid-range Android phone.
