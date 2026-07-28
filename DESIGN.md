# Pinpoint Design System

## Product scene

A renter or buyer explores homes on a phone while moving through the city, or compares options on a desktop at home. The interface should feel calm in bright ambient light, keep the map useful, and make the next decision obvious without advertising-style noise.

## Visual theme

Pinpoint uses clean, very low-chroma green-neutral surfaces with a restrained forest accent. Cream, beige, ivory, and warm-paper casts are excluded from application chrome. Large property photography carries the emotional weight. Interface chrome stays quiet and familiar; depth separates controls from the map without imitating carved or extruded material.

## Color roles

- `background` / `surface-canvas`: clean neutral application canvas with no cream cast.
- `panel` / `surface-panel`: listing rail, sheets, cards, and readable content.
- `surface-floating`: search, map controls, menus, and overlays.
- `ink`: primary text. `muted-foreground`: supporting text.
- `forest`: primary action, current selection, focus, and saved state.
- `gold`: restrained amber emphasis for promotional actions and highlights.
- `mint`: limited positive feedback, never a second competing CTA color.
- Status colors are reserved for success, warning, error, and information.

Light mode uses cool green-white chrome, a near-white panel, green-black ink, deep forest actions, and amber highlights. Dark mode follows the same green-gray axis with pale green actions and avoids peach or warm charcoal casts.

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
- Elevation 1 uses hairline definition, elevation 2 uses a compact soft shadow, and elevation 3 is reserved for menus, sheets, and overlays.
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
