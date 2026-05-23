# Critique: ListingCard

**Target**: [ListingCard](file:///c:/Users/BB/Documents/RoomZA/src/features/map-discovery/discovery-page.tsx#L110-L206) in `discovery-page.tsx`  
**Register**: Product  
**Date**: 2026-05-22

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading indicator when fetching detail after card click; selected ring is subtle |
| 2 | Match System / Real World | 2 | "Home" badge label is confusing; building icon button has no label |
| 3 | User Control and Freedom | 2 | Save is reversible; no other undo or escape path from the card |
| 4 | Consistency and Standards | 1 | Hardcoded colors (`#34A853`, `blue-600`, `gray-*`) bypass the OKLCH design system; duplicate component exists in `property-card.tsx` |
| 5 | Error Prevention | 2 | Error and empty states exist, but no guard against double-clicking |
| 6 | Recognition Rather Than Recall | 2 | Building icon button is unlabeled; badge meaning must be guessed |
| 7 | Flexibility and Efficiency | 1 | No keyboard nav; card is a `<div onClick>` not a focusable element; no multi-action options |
| 8 | Aesthetic and Minimalist Design | 2 | Dashed divider is noisy; building icon button adds weight without clear purpose; badge text is low-signal |
| 9 | Error Recovery | 2 | Error banner is clear; no retry mechanism |
| 10 | Help and Documentation | 1 | No tooltips, no contextual help, no explanation for the building button |
| **Total** | | **17/40** | **Poor: Major UX overhaul required** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?** Partially, yes.

### LLM Assessment

The card follows a recognizable pattern: full-bleed image, floating white info card at the bottom, rounded pill badge, heart save button. This is the dominant AI-generated real-estate card template. What keeps it from full "slop" territory is the intentional 4:5 aspect ratio and the product-specific availability badge. What pushes it back toward slop:

- **Generic grays everywhere.** `text-gray-900`, `text-gray-500`, `text-gray-400`, `bg-gray-100`, `border-gray-200`. The app has a carefully crafted OKLCH palette with tinted neutrals (`--ink`, `--muted-foreground`, `--border`), and the card ignores all of it. The card feels like it was built in a separate project.
- **Off-brand blue.** `text-blue-600` and `bg-blue-50` on the MapPin and building button. The brand accent is `forest` (oklch green). Blue appears nowhere else in the token system.
- **Hardcoded Google green.** `#34A853` on the badge text is literally the Google Maps marker green. Not a design token, not from the palette.
- **The floating-card-on-image template** is the most common AI card pattern in real estate UIs. It works, but it's indistinguishable from thousands of AI-generated Dribbble shots.

### Deterministic Scan

The `npx impeccable detect` CLI scan returned **zero findings** across both [discovery-page.tsx](file:///c:/Users/BB/Documents/RoomZA/src/features/map-discovery/discovery-page.tsx) and [property-card.tsx](file:///c:/Users/BB/Documents/RoomZA/src/components/premium/property-card.tsx). The detector didn't flag the hardcoded colors or duplicate component because those are semantic/architecture issues, not structural pattern matches.

---

## Overall Impression

The card is **competent but generic**. It displays the right information (image, price, beds, baths, location, availability) and the layout is clean. But it fights its own design system, duplicates an existing component, and includes a mystery button nobody can explain. The biggest opportunity: **unify this card with the existing `PropertyCard` component and bring it onto the design token system.** That single change fixes consistency, reduces maintenance surface, and makes the whole card feel like it belongs to RoomZA instead of a generic template.

---

## What's Working

1. **Information density is right.** Price, beds, baths, location, availability, save action: everything a renter scanning listings needs, nothing they don't. The truncation handling is solid throughout.

2. **Image-first layout matches the product intent.** A map-first rental discovery app should let the property image do the talking. The 4:5 aspect ratio gives the photo generous space, and the hover scale effect (`group-hover:scale-105`) provides satisfying tactile feedback.

3. **The save button is well-implemented.** [SaveIconButton](file:///c:/Users/BB/Documents/RoomZA/src/components/premium/property-card.tsx#L155-L175) has proper `aria-label` toggling, `stopPropagation` to prevent card click, visible focus ring, and distinct saved/unsaved visual states. This is the most polished interactive element on the card.

---

## Priority Issues

### [P1] Design system bypass: card uses raw Tailwind instead of OKLCH tokens

**What**: The card uses `text-gray-900`, `text-gray-500`, `bg-white`, `text-blue-600`, `bg-blue-50`, `#34A853`, and other raw values instead of the established design tokens (`ink`, `muted-foreground`, `panel`, `forest`, `warm-surface`).

**Why it matters**: The card visually disconnects from every other surface in the app. In dark mode, this card will render as a white rectangle on a dark page. The grays are untinted (neutral), while the design system uses hue-shifted neutrals (tinted toward green/warm). Users subconsciously register this as "something is off."

**Fix**: Replace every hardcoded color with its token equivalent:
- `text-gray-900` → `text-ink`
- `text-gray-500` → `text-muted-foreground`
- `text-gray-400` → `text-muted-foreground` (with opacity if needed)
- `bg-white` → `bg-panel`
- `bg-gray-100` / `border-gray-200` → `bg-muted` / `border-border`
- `text-blue-600` / `bg-blue-50` → `text-forest` / `bg-accent`
- `#34A853` → `text-forest`

**Suggested command**: `impeccable colorize ListingCard`

---

### [P1] Duplicate component: ListingCard and PropertyCard are near-identical

**What**: [ListingCard](file:///c:/Users/BB/Documents/RoomZA/src/features/map-discovery/discovery-page.tsx#L110-L206) (in discovery-page.tsx) and [PropertyCard](file:///c:/Users/BB/Documents/RoomZA/src/components/premium/property-card.tsx#L40-L153) (in property-card.tsx) share the same layout, same badge, same floating bottom card, same divider, same icon set. They diverge only in prop shape and minor spacing.

**Why it matters**: Two components = two places to fix bugs, two places to update design tokens, two places that can drift. They've already drifted: PropertyCard wraps in `<Link>` or `<button>`, ListingCard uses `<div onClick>`. PropertyCard supports a `compact` variant; ListingCard doesn't.

**Fix**: Delete ListingCard. Refactor PropertyCard to accept the ListingCard's prop shape (or create a shared adapter). Use PropertyCard everywhere.

**Suggested command**: `impeccable distill ListingCard`

---

### [P1] Mystery building icon button has no purpose

**What**: Line 178-180: a blue circle button with a `Building2` icon. It has no `onClick` handler, no `aria-label`, no tooltip. It renders as an interactive-looking element that does nothing.

**Why it matters**: Users will click it expecting something to happen. When nothing does, trust erodes. It also adds visual weight to the card's info section, competing with the title and price for attention.

**Fix**: Either give it a purpose (e.g., "View property type" or link to a property-type filter) and add an `aria-label`, or remove it entirely. If the intent is decorative/categorical, replace it with a non-interactive badge.

**Suggested command**: `impeccable clarify ListingCard`

---

### [P2] Badge copy is confusing: "Home" vs "Available"

**What**: The badge reads "Home" when `availabilityDate` resolves to "Available now" and "Available" otherwise. The word "Home" as a badge label doesn't communicate status, category, or action.

**Why it matters**: Renters scanning 10+ cards need to instantly parse each badge. "Home" doesn't map to any mental model in rental search. Is it a house (vs. apartment)? Is it available? What does it mean? This forces cognitive effort on something that should be zero-thought.

**Fix**: Use clear availability status: "Available now" / "Available Jun 1" / "Coming soon". If property type is the intent, use a separate, smaller indicator.

**Suggested command**: `impeccable clarify ListingCard`

---

### [P2] Broken divider implementation

**What**: Line 184: `<div className="w-full h-px bg-gray-100 my-4 border-t border-dashed border-gray-200">` applies both a background color AND a dashed border to a 1px-tall element. This creates a visual artifact where both render, producing a thicker, muddier line than intended.

**Why it matters**: Subtle visual noise. The divider should be either a solid `bg` line or a dashed `border`, not both stacked.

**Fix**: Pick one. For a dashed line: `<div className="w-full my-4 border-t border-dashed border-border" />`. Drop the `h-px` and `bg-*`.

**Suggested command**: `impeccable polish ListingCard`

---

### [P2] Card is not keyboard accessible

**What**: The card root is a `<div onClick>` with no `role`, `tabIndex`, or keyboard event handlers. Screen readers and keyboard users cannot reach or activate it.

**Why it matters**: This is a WCAG failure. The card is the primary interactive element in the discovery sidebar. Keyboard-only users cannot browse listings at all.

**Fix**: Change the root to `<button type="button">` or add `role="button" tabIndex={0} onKeyDown={handleEnter}`. The PropertyCard component already does this correctly (uses `<button type="button">`).

**Suggested command**: `impeccable harden ListingCard`

---

## Cognitive Load Assessment

| Item | Pass? | Note |
|------|-------|------|
| Single focus | ✅ | One listing per card |
| Chunking | ✅ | Info grouped in badge + bottom card |
| Grouping | ✅ | Title/location together; price/amenities together |
| Visual hierarchy | ❌ | Building icon button competes with title; badge competes with save button |
| One thing at a time | ✅ | Card presents, detail loads on click |
| Minimal choices | ✅ | Two actions: click card, click save |
| Working memory | ✅ | No cross-screen memory required |
| Progressive disclosure | ✅ | Detail loads on demand |

**1 failure = Low cognitive load (good).** The card's information architecture is sound. The visual hierarchy issue is the only concern, and it stems from the purposeless building button.

---

## Persona Red Flags

### Jordan (First-Timer)

*A renter who has never searched for property online in SA. Reads every label. Hesitates before unfamiliar interactions.*

Walking through: Jordan sees a listing card in the sidebar.

- **"Home" badge**: Jordan reads it literally. "Home? Is this my home? Does this mean house?" No tooltip, no explanation. Jordan skips the card, confused.
- **Building icon button**: Jordan taps it. Nothing happens. Jordan wonders if the app is broken. Tries again. Loses confidence.
- **Blue pin icon + green bed/bath icons**: Two different accent colors on the same card. Jordan can't tell if color means something (is blue = location, green = amenities?). It doesn't, but the inconsistency forces mental parsing.
- **No visible help**: No "?" icon, no tooltip, no onboarding hint. Jordan has to figure out every element through trial and error.

**Verdict**: Jordan will struggle with badge meaning and the dead building button. May abandon if first three cards feel confusing.

---

### Casey (Distracted Mobile User)

*Searching for a flat on the bus, one-handed, interrupted frequently. Low patience.*

Walking through: Casey sees the mobile bottom sheet with listing cards.

- **4:5 aspect ratio card in a scroll list**: Each card is very tall. On a mobile viewport, Casey may see only one card at a time in the `45dvh` sheet. Scrolling through 10+ listings means a lot of thumb work.
- **Save button at top-right**: On a tall card, the heart button is far from Casey's thumb (thumb zone is bottom half). Reaching it on a 6.7" phone requires a hand shift.
- **No swipe affordance**: Cards are vertical scroll only. No horizontal card carousel for quick browsing. Casey must scroll vertically through tall cards, which is slow.
- **`<div onClick>` has no tap feedback**: No `:active` state defined. Casey taps and gets no haptic visual feedback that the tap registered.

**Verdict**: The card's tall aspect ratio hurts mobile scanning speed. Save button position is anti-thumb-zone.

---

### Thabo (High-Intent SA Renter)

*A working professional in Johannesburg actively searching for a flat. Checks 3-4 platforms daily. Knows exactly what R8,000/mo gets in Braamfontein vs. Sandton. Speed and structured data matter.*

Walking through: Thabo opens RoomZA and scans the sidebar.

- **No property type visible**: Thabo needs to know if this is a flat, house, or room-share at a glance. The card shows beds/baths but not type. Thabo has to click into every card to check.
- **Price formatting**: `R 8 500` (space-separated) matches SA convention. Good.
- **Availability date hidden behind badge logic**: Thabo cares deeply about move-in date. The badge shows "Available" (vague) instead of "From 1 Jun" (actionable). The actual date string is computed in `getAvailabilityLabel` but the badge overrides it with "Home"/"Available".
- **No way to compare**: Thabo wants to see 3-4 cards side by side or in a compact list. The tall 4:5 cards force one-at-a-time viewing. No compact/list toggle.

**Verdict**: Missing property type and suppressed availability dates slow Thabo down. Thabo will switch to Property24 if this takes longer than their existing workflow.

---

## Minor Observations

- The `transition-all` on the card root is a performance concern. This transitions every animatable property on hover. Use `transition-shadow` or `transition-transform` instead.
- The `unoptimized` prop on the Next.js `<Image>` disables all image optimization. This means full-resolution images load for every card, regardless of viewport. For a card that's at most 480px wide, this wastes bandwidth.
- The selected state (`ring-2 ring-forest ring-offset-2`) is subtle and may not be visible enough, especially against a green-heavy property photo.

---

## Questions to Consider

- What was the building icon button originally intended to do? Should it become a property-type indicator, a "view details" affordance, or should it be removed?
- The card is very tall (4:5). Would a more compact variant (16:9 or even horizontal) improve scanning speed in the sidebar, especially on mobile?
- Should availability dates be shown directly on the card instead of the ambiguous "Home"/"Available" badge?
