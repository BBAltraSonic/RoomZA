# Pinpoint Design System

Approved direction: 16 October 2026. This document supersedes the earlier forest,
light-blue, navy, cream-header-only, and no-bottom-tabs rules. The supplied redesign
reference guides the visual language; its demonstration content is not product data.

Discovery layout revised 12 November 2026: one header bar, a results panel that owns
its own controls, and compact result rows. Brand colours, type and tokens are unchanged.

## Product scene and identity

People compare homes, local services, shopping specials, places, and events on a
phone outdoors or a desktop at home. Discovery remains map-first. Dark maps provide
spatial context beside calm, warm panels; the full dark theme supports dim settings.
Mobile and desktop receive equal attention.

Keep the existing Pinpoint mark and current sans-serif font. All categories share
one identity. Property, Specials, and Services remain the primary discovery groups;
Shopping, Places, and Events stay inside Specials. Visible naming uses Places while
the internal tourism contract remains unchanged.

## Color system

Use restrained charcoal and amber, with photography carrying visual interest.
Shared reference anchors are expressed in OKLCH in `src/app/globals.css`:

| Role | Reference | Usage |
| --- | --- | --- |
| Charcoal | #151A24 | Navigation, light-theme primary actions, primary text |
| Amber | #D89B23 | Selections, active navigation, saved states, highlights |
| Warm canvas | #F2F0EC | Light application and results canvas |
| Near-white panel | #FBFAF7 | Light cards, forms, floating details |

- Light mode retains a dark top header and a dark map stage. The results panel is a
  warm card on that stage, holding near-white result cards.
- Dark mode uses layered charcoal surfaces, near-white text and primary buttons,
  and the same amber selection fill. Maps stay dark in both themes.
- Use `primary` / `primary-foreground` for actions, `selection` /
  `selection-foreground` for filled selections, and `brand-ink` for accessible amber
  text. Raw amber is not small text on light panels.
- `background`, `panel`, `surface-floating`, `ink`, `muted-foreground`, `border`,
  `input`, and `ring` govern shared components and their interactive states.
- Legacy `forest` aliases primary; `clay` and `moss` alias brand ink; `gold` aliases
  amber. These names preserve existing consumers, not the previous brand hues.
- Success, warning, error, and info retain separate semantic surface/border/text
  roles. Labels and icons explain their meanings. Never use color alone for state.
- Media retains stable dark chrome. Official provider marks and scannable QR
  backgrounds retain their required colors.

## Typography, shape, and spacing

- Keep the current font family. Use weight, scale, and spacing for hierarchy.
  Headings are 20–32px, body 14–16px, metadata 12–13px. Prose stays below 72ch.
- Use a 4px spacing rhythm and 8px component increments. Discovery imagery and
  forms have breathing room; inboxes, listing management, and admin tables can be
  denser. Do not remove information to create artificial simplicity.
- Controls use 12px corners; photographic cards 20px; compact result rows 16px;
  panels and sheets 24px.
  Pills suit selectors and prominent actions. Use restrained neutral shadows.
- Interactive touch targets are at least 44px. Provide hover, focus, pressed,
  selected, disabled, loading, validation, and failure states where relevant.

## Navigation and discovery

- Mobile destinations: Explore, Saved, Create, Messages, Profile. Create opens
  `/post`; My listings remains in Profile. Guests retain sign-in return paths.
- Show tabs on discovery and ordinary workspaces. Hide them on authentication,
  applications, conversations, listing editors, live calls, and immersive media.
  Admin retains its own navigation and existing permission boundaries.
- Desktop workspaces retain their direct account navigation and Create listing.
- Discovery owns category, location, search, Rent/Buy, filters, and sorting. Other
  screens do not inherit discovery-specific controls.
- The discovery header is one bar: brand, the Specials / Property / Services tabs,
  a combined where-and-what field (location, then search), and account actions. It
  has no second row on desktop.
- Sorting, Rent/Buy, service type and Filters sit with the results they change. On
  desktop they dock at the top of the results panel and stay put while results
  scroll; the Filters panel opens beside the results panel, over the map. On mobile
  they stay in the header behind Refine, and Property repeats Rent/Buy beside the
  count in the sheet. There is only ever one instance of each control.
- Desktop keeps a results panel beside the map, never over it, so every pin in view
  matches a result: a rounded card with 8px gutters on the dark stage, 380px wide,
  420px from 1280px, 460px from 1536px. Full details float inside the map pane at
  400px, expandable to 600px, bounded by the available pane. Keep results mounted
  and suppress duplicate previews while full details are open. Controls remain
  reachable beside details.
- Property results are compact rows: photo beside price, title, area, facts, whole
  signal chips and contact actions, with Save beside the price rather than on the
  small photo. Rows lift on hover without growing. Aim for four or more rows in view
  on a laptop and at least one in the Browse sheet. Stacked photo cards remain for
  Services, Specials and saved grids.
- Anything lazy-loaded inside discovery declares its own loading state. A piece that
  suspends without one replaces the whole workspace, map included, with the page
  fallback.
- Mobile results retain Peek, Browse, and Full List positions. Search stays docked
  to the sheet. Category sheet positions persist independently. Details scroll
  internally below navigation. Sheets and map controls respect bottom tabs,
  keyboard viewport changes, and device safe areas.
- Preserve `listingId`, `detailId`, filters, category parameters, location, map
  state, deep links, browser history, and scroll/focus restoration. Legacy Feed
  URLs retain their current map behavior and state.
- Counts and trust/availability claims come from actual data. Keep previous
  results visible during refresh; failures never masquerade as successful empties.

## Motion and accessibility

Use expressive but purposeful selection, panel, sheet, and feedback transitions.
Fast feedback is 120ms, standard transitions 220ms, large transitions up to 380ms.
Favor exponential ease-out and transforms/opacity. Avoid delaying routine work.
Reduced motion removes travel, zoom, and scaling. Celebrate completed goals once.

Normal text meets 4.5:1 contrast; large text and meaningful non-text controls meet
3:1. Keep keyboard alternatives for gestures, operable markers, visible focus,
labelled controls, and status feedback. Contained discovery details are non-modal;
nested dialogs retain their own focus and Escape behavior.

## Marketplace and implementation boundary

One ordinary account can browse and list in every category. There is no role-mode
switch. `/post` opens the category chooser; `/post/listings` links to existing
category workspaces. Category review, consent, ownership, suspension, publishing,
and admin rules remain independent and unchanged.

The representative discovery, details, listing creation, and My listings review
was approved on 17 October 2026. The system now extends through account access,
profile/settings, messaging, application/purchase/viewing workflows, listing
editors, admin, public pages, and installed-app branding. Shared tokens govern
all surfaces. Visual evidence distinguishes live routes from fixture component
previews; neither implies a completed authenticated or real-device journey.
No deployment, migrations, or external email redesign is included.
