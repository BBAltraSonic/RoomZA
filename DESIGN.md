# Pinpoint Design System

## Product scene

A renter or buyer explores homes on a phone while moving through the city, or compares options on a desktop at home. The interface should feel calm in bright ambient light, keep the map useful, and make the next decision obvious without advertising-style noise.

## Visual theme

Pinpoint uses clean, very low-chroma green-neutral surfaces with a restrained forest accent. Cream, beige, ivory, and warm-paper casts are excluded from application chrome. Large property photography carries the emotional weight. Interface chrome stays quiet and familiar; depth separates controls from the map without imitating carved or extruded material.

### Discovery header reference, 3 October 2026

The supplied reference overrides the neutral-chrome rule for the discovery header and category selectors. A visitor browses nearby specials or homes on a phone outdoors, or compares them on a desktop in daylight. This surface uses warm cream, forest-green selections, and a lime count accent, with a corresponding forest-neutral dark theme. These variables stay scoped to shared Pinpoint navigation chrome; Property content and map tokens keep their existing palette.

Discovery is map-only across Property, Services, and Specials. Legacy Feed URLs render the map with their location, filters, pagination, and listing context preserved. The first row holds Pinpoint branding, location, desktop category-specific search, saved homes, notifications, listing intake, and the account menu. Mobile search stays attached to the results sheet. The second row holds Specials, Property, and Services plus relevant sorting. Property keeps its rent/buy and detailed filters below these rows. Phone layouts wrap controls with 44px targets. Category links carry the selected place, and the active Property link retains its complete query. Counts come from successful loaded results, never the reference image. Services and Specials use their public map and results sheet.

### Shared application navigation, 7 October 2026

The current Pinpoint mark, singular wordmark, cream/forest chrome and compact account control now apply to ordinary workspace and public headers as well as discovery. Palette variables remain scoped to navigation surfaces and brand components; page content retains its existing tokens.

Discovery owns its category, location, search, and filter controls. Ordinary pages use renter/landlord destinations or public links, notifications for signed-in users, and Add listing for landlords. They have no discovery category row or Rent/Buy/search controls. The account control is embedded in the header rather than floating over content.

Route classification chooses one chrome owner: discovery at /, /offers and /services; admin under /admin; existing focused workflows; and a workspace/public header for other pages, including nested Profile, Settings and poster routes. Account state remains provided by the root shell without waiting for profile reads.

Workspace desktop destinations appear at 1024px. Mobile navigation uses the profile menu across the app, with every renter and landlord destination available there and no bottom tabs or reserved tab-bar height. Admin keeps its 768px sidebar boundary and uses a mobile header with a profile menu containing all admin sections, preserving owner-only visibility. Focused editors, conversations and authentication retain their task layouts, with updated branding wherever already present.

Visual checks at 320, 390, 768, 1024 and 1440px in light and dark themes are prepared but pending under the existing browser-attempt cap. Source-test results do not establish responsive visual or deployed behavior.

## Color roles

- `background` / `surface-canvas`: clean neutral application canvas with no cream cast.
- `panel` / `surface-panel`: listing rail, sheets, cards, and readable content.
- `surface-floating`: search, map controls, menus, and overlays.
- `ink`: primary text. `muted-foreground`: supporting text.
- `forest`: primary action, current selection, focus, and saved state.
- `gold`: restrained amber emphasis for promotional actions and highlights.
- `mint`: limited positive feedback, never a second competing CTA color.
- Status colors are reserved for success, warning, error, and information.

Light mode uses airy green-white chrome, an almost-white panel, softened green-black ink, medium forest actions, and light amber highlights. Dark mode follows the same green-gray axis with lifted charcoal surfaces and pale green actions, avoiding both near-black heaviness and peach or warm charcoal casts.

## Typography

Use the existing sans-serif family across headings, controls, and body text. Prefer weight and a compact fixed scale over decorative display type. Discovery headings are 20–24px, card titles 16px, body 14px, metadata 12–13px. Keep prose below 72 characters per line.

## Spacing and layout

- Base rhythm: 4px, with 8px as the normal component increment.
- Control height: 40px desktop, at least 44px touch.
- Desktop discovery: 440–520px results rail plus a continuously useful map.
- Mobile discovery: full map with collapsed, partial, and expanded results sheet.
- Do not nest cards or place editorial modules inside the active map-results rail.

## Shape and elevation

- Radius: 12px controls and cards, 16px panels, 24px sheets, full pills only for compact selectors and actions.
- Featured panels use uniform corners. Promotional imagery may overlap at -4deg and +3deg; text and functional controls remain axis-aligned.
- Elevation 1 uses faint hairline definition, elevation 2 uses a compact low-opacity shadow, and elevation 3 is reserved for menus, sheets, and overlays.
- Use cool, low-opacity shadows. Do not use paired light/dark neumorphic shadows or inset press effects.

## Motion

- Fast feedback: 120ms.
- Standard state transition: 220ms.
- Sheet and large-state transition: 380ms.
- Use exponential ease-out and the shared soft, medium, and bouncy spring presets. Motion may animate transforms, opacity, bounded blur, and FLIP-style layout changes, but not layout-driving properties.
- Route transitions communicate forward, back, and replacement navigation. Progressive page regions may enter at 30-60ms intervals, and result batches may stagger by 40ms for at most ten items.
- Motion communicates hierarchy, loading, disclosure, selection, navigation, and action outcomes. Celebration effects are one-shot and reserved for completed user goals.
- Under `prefers-reduced-motion`, remove travel, zoom, and blur transitions; retain immediate color or opacity feedback.

## Component states

Every interactive component implements default, hover, focus-visible, pressed, disabled, and loading states where applicable. Selection uses a forest outline or filled marker, not extra decoration. Errors remain visible until resolved and are never rendered as successful empty results.

## Accessibility

- One semantic primary action per property card.
- Minimum touch target is 44px.
- Gestures always have labelled button and keyboard alternatives.
- Dialogs trap and restore focus, expose a name, and support Escape.
- Map markers are keyboard-operable and expose selected state.

## Do / do not

- Do prioritize imagery, spatial context, price, location, and essential facts.
- Do retain previous results while a viewport refresh is in progress.
- Do use progressive disclosure for cost breakdowns and amenities.
- Do not copy benchmark branding, assets, or proprietary layouts.
- Do not use urgency copy, advertising badges, nested cards, or decorative blur unrelated to navigation or focus hierarchy.
