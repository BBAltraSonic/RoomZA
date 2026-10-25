# First review set: verification

16 October 2026. These results cover the shared foundation and representative
screens, not a completed application-wide UX pass or production deployment.

## Source checks

| Check | Result |
| --- | --- |
| Focused Vitest suites | 33 files, 256 tests passed |
| TypeScript | Passed within the isolated production build |
| Changed-file ESLint | Passed |
| Scoped whitespace/diff checks | Passed |
| Next.js production build | Passed, webpack |
| First-load client budget | Passed for 95 routes, 1300 KB threshold |
| Property initial client bundle | 295.1 KB compressed, below 300 KB |

The isolated build contains the existing working tree, including preserved work
from before this redesign. `source-manifest.json` records matching SHA-256 hashes
for 27 runtime files in the workspace and the verified build snapshot.

The build retains Next.js's middleware deprecation notice. No migration or
deployment was performed. Updated visual-test assertions describe the new palette
and rail layout; screenshot golden baselines await design approval.

## Browser and component evidence

| Coverage | Checks | Evidence |
| --- | ---: | --- |
| Property discovery/details | 17 | Local production routes and sample API responses |
| Services, Shopping, Places, Events | 56 | Local production routes, sample public responses, category details |
| Loading, failed request, retry, successful empty response | 12 | Actual Property UI with controlled response states |
| Create chooser, My listings, quick-draft form | 30 | Static renders of actual application components |
| Short screens and normal motion | 6 | Actual Property routes and detail dismissal |

These are 121 fixture/component layout and interaction checks, not 121 authenticated
user journeys. The gallery contains 64 screenshots, including both themes at
390px and 1440px. Layout matrices also include 320px, 768px, and 1024px.

Checks cover retained desktop results, contained mobile details, visible discovery
navigation, tab clearance, internal scrolling, panel expansion, URL dismissal,
Escape and nested-dialog behavior, sheet position restoration, guest return links,
category-specific content, and horizontal overflow. Short-screen checks include
320×480, 390×540, 768×540, 1024×540, and 1440×540. The normal-motion detail flow
also opens and closes successfully; the main matrices use reduced motion.

Normal text, actions, semantic statuses, media text, selected fills, focus rings,
and form-control boundaries pass the relevant automated contrast checks.

The final Property detail captures use a cached copy of the same sample
photograph, with image-loaded state checked before capture. This removes external
image-host timing from the review images; it does not establish live media-host
availability or image-loading performance.

The successful discovery/category runs recorded no uncaught page errors or app
route render errors. Property logs include one failed SSL request to
`https://localhost:3015/auth?redirect=%2Fsaved`; the disposable local server serves
HTTP. This is not evidence of a completed authentication journey.

## Explicit limits

- The map style is a fixture canvas. Live MapTiler tiles, roads, labels,
  attribution content, and real geography rendering remain unverified.
- Public listing responses are fixtures. An unmocked development API request
  reported a missing `pinpoint_property_contacts` RPC. No database repair was
  attempted as part of this visual work, and live data remains unverified.
- Protected workspace previews are static component renders. They do not submit
  forms, bypass route authorization, or prove private-data access. The draft-form
  preview exercises the unavailable-map state with submission disabled.
- Physical keyboard behavior, device safe areas, touch gestures, real accounts,
  applications, messages/calls, notifications, publication, and production
  behavior require separate verification.
- Authentication, account/admin screens, remaining forms, raster app icons, and
  other non-representative surfaces await the agreed review gate and next pass.

Raw layout results, diagnostics, and source coverage are retained in
`browser-evidence.json` and `inventory.json`. The local build and detailed logs
remain under `.cache/pinpoint-redesign-20261016/`.
