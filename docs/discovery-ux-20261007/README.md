# Discovery fixes — 7 October 2026

All critique findings were addressed across Property, Shopping, Tourism, Events and Services.

- Location selection is an actionable first-visit step, visible in mobile Map panels. Irrelevant search/sort controls wait for a location.
- Property distinguishes a selected place from the current map area, while retaining factual recent-listing context.
- Empty Property results offer Clear filters or Choose another location. Clearing uses one URL update and preserves place, market, view, sort and unrelated parameters.
- Removed duplicate empty map overlays, zero badges, initial promotional interruptions, empty-state tips and unusable card arrows. Area alerts are secondary and only appear with valid bounds.
- Property uses one sort control retaining Latest, both price orders and Nearest (existing Closest URL value).
- Page-local search is labelled beside the field; counts distinguish total results from results shown on this page.
- Mobile search and refinements are disclosed when needed. Empty recovery remains fully visible; Rent/Buy, clear and close controls retain 44px targets.
- Long descriptions expand on request. SAST dates keep hours/minutes; exact publication windows are unchanged.

## Verification

114 assertions passed across 17 relevant test files. After final Property polish, 44 assertions passed again across 3 files. TypeScript and targeted ESLint passed. The final dark-header brand and icons measured a 10.98:1 contrast ratio against the header surface.

Local browser evidence covers 30 viewport captures, widths 320/390/768/1024/1440, first visits, selected empty results, filtered recovery, populated Feed/Map, page-local search, keyboard chooser dismissal, touch targets, sort selection and a dark Property view. There were no page errors or attempted write requests in the recorded runs. See [verification.json](verification.json).

Fresh review findings about alerts without bounds and long location names in the compact sheet were fixed. Raw harness diagnostics are retained; an incorrect sort option string in the main script was corrected and that interaction passed in the supplement.

## Evidence limits and preservation

This is isolated local UI verification using synthetic intercepted read responses and a blank map style. It does not prove live map-provider rendering, real-device behavior, staging or production readiness. No deployment, database write, poster contact or release harness was performed. Production credentials were disabled for the preview.

Existing uncommitted work, Property link/detail contracts, saved-home flows, rent/buy behavior, and map pin/card design were preserved. The owned preview was stopped, its generated configuration changes restored and its cache removed.

## Selected captures

- [Mobile location selection](shopping-start-320.png)
- [Mobile Property recovery](property-long-location-320.png)
- [Desktop first visit](shopping-start-1440.png)
- [Populated mobile Services map](services-map-populated-390.png)
- [Dark Property](property-dark.png)
