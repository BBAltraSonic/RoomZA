# Pinpoint rendering repair — 8 October 2026

Implemented locally. **Release acceptance remains open. No deployment.**

## Repairs

- Stable, visible shared page content; removed route keys, whole-page opacity/blur/scale and shell focus stealing. Optional Motion feature failure resolves to the installed minimal feature bundle. Reduced motion uses that smaller bundle.
- Reveals and list content render visibly on the server. Counters show their actual value immediately. Image state resets per source and handles cached load/error events.
- One shell-lifetime auth subscription; deduplicated refreshes, immediate known identity, independent bounded profile/admin reads, synchronous sign-out clearing and previous-user rejection. Server authorization stays intact. Saved-home and private purchase display stores clear on identity changes.
- Current-request checks after Property detail JSON parsing, controller ownership for success/error/completion, selection/market/closure cleanup, listing read guards and deterministic server-first recent-history defaults.
- Read ownership and cleanup across imports, passkeys, eligibility, messages/calls, live tours and showings. Journey subscriptions retain a trailing refresh after bursts. Public category/entity state resets on incompatible identities; successful results survive refresh failures where valid, with existing Specials expiry timers retained.
- Deferred the import rows table behind its existing panel, with a visible loading state, to retain bundle budgets.
- Post-browser correction: Trust grids now explicitly use one constrained column on mobile and allow children to shrink. This addresses the observed policy-tab overflow without changing legal content or design. **Not rechecked in a browser.**

## Verification

| Check | Evidence |
|---|---|
| Full suite | 249 files passed; 1,412 tests passed; 5 opt-in local DB tests skipped. See quality.json and its retained test log. |
| Final focused regressions | 7 files / 25 tests passed, including added eligibility closure/selection, trailing subscription refresh and rapid history assertions. Tests overlap the full suite; counts are not additive. |
| Final TypeScript / lint | Passed. See post-browser-typecheck.log, post-browser-lint.log, final-source-checks.json and final-focused.log. |
| Isolated production build | Passed with inert loopback settings, no copied environment files. build.json records the final source snapshot and log. |
| Existing bundle budgets | All 91 measured route manifests below 1,300 KB; root initial JS 252.5 KB gzip, below 300 KB. |
| Preservation | 1,635 task-start files checked; no unexpected changes; package-lock.json and .env.local hashes preserved. |
| Static route/effect audit | 89 page sources with inherited loading/error boundaries recorded in route-ledger.json; 49 asynchronous effect locations in effect-inventory-final.json. This is a source audit, not proof of every page or every data state. |
| HTTP preflight | 42 fixture routes returned HTTP 200 and the stable wrapper. SSR can stream recoverable errors with 200; three fixture-rejected read/mutation attempts appear in local-server.log. This is not protected-route/browser/auth proof. |

Initial quality failures and the initial 1,311.5 KB import-route bundle failure are retained in earlier logs/build-first.json. They were corrected; budgets were not increased.

## Bounded browser result

The approved live diagnostic had already stopped on a DOMContentLoaded timeout. Its precise live startup blocker remains unresolved; live-diagnostic.json preserves that run.

The one approved local browser run launched once and stopped at its first unexpected failure. Nine 320 px public cells passed: Property Feed, Specials and Services onboarding, sign-in, forgot/reset password, Blog, Trust overview and Safety. Content was visible, tested controls responded, and these cells had no page startup/hydration errors or unhandled rejections.

The next navigation, /privacy → /trust/privacy, produced a 411 px document at a 320 px viewport. Retained trace/screenshot and source point to an unconstrained Trust grid around horizontally scrolling policy tabs. The source correction is compiled and linted, but no second browser attempt was made.

Protected families, populated public fixtures, Map interactions, 390/768/1024/1440 widths, reduced-motion browser checks, rapid browser back/forward and intentional loading/error recovery were **unreached and unverified**. Unit regressions cover several of those behaviors without establishing full runtime acceptance.

Eight captured LCP values ranged from 68 to 300 ms; the Property cell lacked an LCP sample. Captured CLS was 0 in the nine passed cells. Recorded interaction event durations ranged from 16 to 48 ms where available; this is a small scripted lab sample, not validated INP or production field performance. Conditions: headed Chromium, Windows, production Next build, loopback, no CPU/network throttling; synthetic Supabase data, generated local images and blank map style. Document CSP was relaxed only for fixture loopback connections. No real authentication/security assertion follows from synthetic cookies.

## Review package and remaining gate

- session-source.patch compares against task-start source, including pre-existing uncommitted work. Do not apply it on an arbitrary Git-clean base; session-changes.json supplies before/after hashes.
- route-ledger.md/json explicitly separate source, HTTP and browser evidence. browser.json and browser-evidence/ retain the driver hash, screenshots, failure and trace.zip. The lock prevents accidental browser reruns.
- build.json contains the final isolated build; build-browser-tested.json identifies the earlier snapshot actually used in the browser. The only subsequent runtime change is the Trust grid correction.
- Existing data, saved-home APIs, listingId links, rent/buy filtering and map/pin/card design were preserved. No schema, permission, shared database or deployment change was made.

Release approval requires a separately authorized bounded browser verification of the corrected failure and remaining matrix, resolution or explicit isolation of the live startup stall, and environment-specific release checks. This package makes no flawless or production-performance claim. Deployment requires separate approval.
