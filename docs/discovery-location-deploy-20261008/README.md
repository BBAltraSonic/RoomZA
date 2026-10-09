# Discovery location repair deployment — 8 October 2026

The repair is live at [Rondebosch Specials](https://roomza.pinpoint-roomza.workers.dev/offers?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch&view=map).

Worker version `29167213-1fce-439b-a284-7f481efd21e1`, deployment `5bc9fd20-bcdc-4ae8-bad5-2e92dd070972`, receives 100% traffic. Rollback candidate: `29c78895-e7f6-48ba-ad12-bc22111c268b`.

The isolated release contains the three repaired query readers and the new shared query hook plus two regression test files. It builds on the preceding shared-card release. Four unrelated workspace files changed concurrently during packaging; these edits were left intact and were not shipped. The six repair source/test files and retained release snapshot passed drift guards before upload.

## Checks

- Isolated regression suite: 15 tests passed; previous local preservation suite: 43 tests passed.
- TypeScript, ESLint, production dependency audit, Next/OpenNext production build and all existing size budgets passed. Initial JavaScript: 251.4 KB compressed, limit 300 KB. Worker size check: 3035.6 KiB gzip, limit 3072 KiB.
- 27 read-only live HTTP checks and 39 served asset hash comparisons passed.
- Runtime compatibility and all existing binding names/types/public values match the previous release. No secrets were read or replaced, and no server secrets were supplied to the local build.
- Exactly one authorized desktop Chromium session passed four category checks. Shopping opened directly with the Rondebosch query; subsequent UI navigation to Tourism, Events and Services retained the area ID and showed two demo cards per category. Events had one Upcoming card and one Available now card. No page or console errors were observed.
- Map canvases were visible; the Events screenshot shows loaded map tiles and demo pins. The initial Shopping screenshot was captured before its tiles finished loading. The check establishes discovery/card behavior, not comprehensive map rendering or other viewport coverage. Some in-flight requests were aborted during navigation/closure; these are retained in browser diagnostics.

The release performed no database writes or repeated imports. Existing demo accounts, listings and provenance remain as recorded in the original demo manifest.

## Evidence

[Release manifest](release.json), [HTTP/asset checks](smoke.json), [browser result](browser.json), [browser trace](browser-trace.zip), [Shopping screenshot](browser-shopping.png), [Tourism screenshot](browser-tourism.png), [Events screenshot](browser-events.png), [Services screenshot](browser-services.png).

Build, package, deploy and before/after rollout logs are retained in this folder. Disk pressure prompted an attempted removal of a generated cache in the previous retained release; automatic approval review rejected that action with only “blocked by policy.” The cache was left untouched, and build/deployment completed with available space. No cleanup bypass was attempted.
