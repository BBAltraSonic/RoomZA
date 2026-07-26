# Pinpoints Google Maps style

Pinpoints uses a Google Cloud Map ID so Advanced Markers and cloud-based map
styling can coexist. Set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` to the Map ID attached
to the production web map.

Production configuration:

- Google Cloud project: `nandie`
- JavaScript vector Map ID: `5b69a1c35b2354a5c3f7d0c8`
- Published light style: `Pinpoints Discovery - Low Noise`
- Published style ID: `507c6eae5e3323c01ed9aaad`

## Required cloud style

In Google Maps Platform, create a light, low-noise style and attach it to the
Map ID used by Pinpoints. The exact style can be imported from
[`pinpoints-google-map-style.json`](./pinpoints-google-map-style.json).

Hide labels and icons for:

- Business and commercial points of interest
- Attractions
- Medical points of interest
- Places of worship and government points of interest
- Transit stations, stops, and transit icons

Keep visible:

- Roads and road labels
- Administrative boundaries
- City, suburb, and neighbourhood labels
- Parks and landscape
- Water

The JSON file is a Cloud Console import source, not a client-side fallback.
Google Maps ignores client-side style JSON when a cloud Map ID is active, and
Advanced Markers require a Map ID. Without the environment value, discovery
uses Google Maps Platform's stable `DEMO_MAP_ID` so local development still
renders Advanced Markers, but POI suppression is not considered verified.

## Acceptance check

Open map discovery with the configured Map ID and confirm that business,
hospital, attraction, and transit icons no longer compete with Pinpoints
clusters or prices at zoom levels 10 through 15. Roads, locality labels, parks,
and water must remain legible.
