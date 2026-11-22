# Pinpoints MapTiler map configuration

Pinpoints renders MapTiler maps with MapLibre GL JS. Set
`NEXT_PUBLIC_MAPTILER_API_KEY` to a browser key created in the RoomZA MapTiler
account. The value is intentionally visible to browsers, so the production key
must be restricted by allowed HTTP origin.

## Required key restrictions

Create a dedicated key for Pinpoints and allow:

- `localhost` for local development.
- `roomza.pinpoint-roomza.workers.dev` for the Cloudflare Worker.
- Every active custom production domain and subdomain that serves the app.

Do not commit the key or use MapTiler's unrestricted default key in production.
Keep the local value in `.env.local` and provide the production value to the
Cloudflare build environment.

## Basemap

The app uses MapTiler Base v4:

- `base-v4-light` in light mode.
- `base-v4-dark` in dark mode.

MapLibre loads the style directly from `https://api.maptiler.com`. Listing
clusters, price pins, the selected-listing radius, nearby places, and property
popups remain application-owned layers above that basemap. MapTiler attribution
must remain visible.

## Content Security Policy

The application CSP permits `https://api.maptiler.com` in `connect-src` and
`img-src`. MapLibre workers use `worker-src blob:`. Do not add third-party map
hosts unless a new production dependency requires them.

## Acceptance check

With the protected key configured, open discovery in light and dark mode and
confirm:

- Base tiles, labels, and required attribution render.
- Broad zooms show clusters and close zooms show price pins, never both.
- Search and viewport labels resolve South African locations through MapTiler.
- The landlord location picker supports suggestions, map clicks, and pin drag.
- Browser network traffic contains MapTiler requests and no Google Maps or
  Mapbox SDK requests.
- The browser console contains no CSP, WebGL, style, sprite, or glyph errors.
