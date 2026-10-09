# Map repair — 3 October 2026

The public map failure was reproduced at `https://roomza.pinpoint-roomza.workers.dev/?view=map`. MapTiler's style, tile metadata and sprite requests returned HTTP 200, but the console reported `Worker failed to load. Check that the worker URL is correct.` The map switched to its error screen with no canvas. A second error was `Cannot read properties of undefined (reading 'center')`.

## Changes

- Serve MapLibre's worker and its relative shared-module dependency from `/maplibre/<installed-version>/`. `scripts/ops/copy-maplibre-worker.mjs` copies both files from the installed package before development, normal builds, Cloudflare previews and Cloudflare deployments. Generated assets are ignored by Git; the version in their URL prevents mixing cached worker files with a newer library.
- Supply that same-origin worker URL through the React map's `workerUrl` property, which sets it before constructing the map. The map remains behind its existing client-only lazy loader.
- Pin `react-map-gl` to 8.1.2, whose MapLibre wrapper supports the v6 camera API. The lockfile changes only the root specification and the three React map packages; unrelated existing dependency edits are preserved.

The setup follows [MapLibre's Next.js worker instructions](https://maplibre.org/maplibre-gl-js/docs/) and [the React map wrapper's 8.1.2 compatibility release](https://github.com/visgl/react-map-gl/releases/tag/v8.1.2).

## Verification

- A read-only check of the deployed page reproduced the failure. Browser-only substitution of the worker URL and the two local worker files restored the rendered map, but retained the older deployed wrapper's camera error. This was diagnostic substitution, not a deployment.
- A separate isolated browser harness bundled the actual modified `MapView` with installed MapLibre 6.11.2 and React map wrapper 8.1.2. It served the generated worker assets, a synthetic local GeoJSON style and a synthetic property. Favorites, geocoding and the Next image component were stubbed. It used no production credentials and made no database writes.
- Both 1440×900 and 390×844 checks passed: one canvas, actual module-worker loading, loaded GeoJSON source, zoom narrowed reported bounds, drag panning, property marker selection, three camera callbacks and zero page errors. Desktop also opened the property popup and invoked its Enquire callback. Screenshots: `map-repair-1440.png` and `map-repair-390.png`.
- Six focused Vitest files passed, 42 tests: worker asset/build-hook integration, provider adapter, map rendering/configuration, map controls, discovery URL/filter preservation and discovery mounting.
- Full TypeScript check passed. Targeted ESLint passed with one existing internal-navigation warning in `map-view.tsx:304`. Whitespace checks passed. Generated worker and shared module hashes exactly match the installed package files.

## Limits

This repair has not been deployed; the public site still runs the older code. A full Next.js/Cloudflare production build was not run. The isolated source browser check does not prove a deployed release, live geocoding, populated database results or authenticated saved-home writes. The existing local development page stalled before rendering and its development environment lacks a MapTiler key; neither issue was worked around using production credentials. Existing database, environment and unrelated source work were left intact.
