# Private Shopping Offer screen — 1 October 2026

Status: verified on the shared local database through a contained dedicated Next development app and real Chromium cookie sessions. This closes a local implementation substep, not a Release 1 acceptance item. Review MFA, approval, public discovery, staging and production remain open.

## Delivered

Eligible signed-in accounts can explicitly enroll at `/post/offers` without choosing a Property persona. The profile menu exposes the workspace. Posters see only their own offers, save partial drafts, search the stored South African place catalogue, enter the shop's exact public point and South Africa validity times, preview, submit a saved complete draft, inspect the immutable submission/history and confirm withdrawal. Failed writes retain unsaved text. Version conflicts stop further writes until the latest version is loaded; uncertain submission retries retain the revision ID. No publishing capability is exposed.

The original `schema.ts`, `lifecycle.ts`, `intake.ts` and intake migration hashes match the previous B7 evidence. Cookie adapters and database ownership checks remain in use. Property location search retains its existing default endpoint; only the poster selector uses the authenticated stored-catalogue endpoint.

## Observed verification

The final contained run passed ten real browser/API/SQL cases: anonymous POST denial before RPC; sign-in return without a Property persona; partial save and incomplete submission denial; desktop stored-place submission; stale second-tab HTTP 409 without overwrite; confirmed withdrawal, fresh resubmission and retry deduplication; phone submission and persisted reload; cross-poster read/write denial; immediate suspension write denial; and retained unsaved text with account-recovery navigation. Desktop was 1440×900, phone 390×844, with the browser in Los Angeles time to verify explicit South Africa timestamps.

Cross-poster direct navigation displayed the unavailable page without offer content. Next's streamed not-found response returned HTTP 200 in this run; the record preserves that status rather than claiming HTTP 404. Cross-poster writes returned 403. No unexpected page/console errors or horizontal phone overflow occurred. Screenshots were visually inspected.

The focused run passed 161 tests in 16 files, including the offer model/adapters/editor/access API, sign-in/redirect/menu and existing Property/place/Feed regressions. Full typecheck passed. Full lint passed with 12 existing warnings. These are local checks, not the full release command suite or a production build.

During verification, early streamed clicks exposed a pre-hydration interaction gap, and the suspension check exposed middleware's structured error being rendered as `[object Object]`. Controls now wait for hydration; the request client reads the standard error message and provides the suspension recovery link. Interrupted fixture attempts completed guarded cleanup before rerunning. Only the final successful run is acceptance evidence.

## Containment and cleanup

Only loopback local demo credentials were used. Email/QStash/push/geocoder/telemetry credentials were absent from the dedicated app, a server fetch guard and browser routes blocked external destinations, and three database schedules were paused before disposable accounts and offers were created. Fixture email subscriptions were disabled; no fixture notification events appeared. The shared runtime was neither upgraded nor probed through its known revoked-RPC crash path.

Captured account IDs/emails, offer/revision IDs, place provider tag, all public-table counts, Auth user and storage object counts, schedules, Property content fingerprints and source hashes are in [the JSON evidence](pinpoint-offer-screen-local-evidence.json). Cleanup checked ownership before deleting only fixtures, restored immutable triggers and schedules, and restored all captured counts and Property fingerprints. The dedicated app and browser stopped.

Evidence: [desktop](pinpoint-offer-screen-desktop.png), [phone](pinpoint-offer-screen-phone.png), [machine-readable run](pinpoint-offer-screen-local-evidence.json).

## Next dependent slice

Build the private pending-submission queue and correction/rejection screen using cookie credentials and the existing reviewer policy. Verify real cookie MFA on a disposable patched clone; the affected shared runtime with TOTP disabled cannot establish that positive gate. Approval/publication requires separately settled provenance, publishing-permission and media-rights checks. Tourism is now agreed as continuing experiences with availability windows; exact window, pause/renewal and visitor destination rules remain open.
