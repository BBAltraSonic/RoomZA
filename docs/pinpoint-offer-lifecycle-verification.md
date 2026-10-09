# Shopping Offer lifecycle foundation — 30 September 2026

Owner: Build. Checkout: existing uncommitted RoomZA tree, inspected once at session start. This is one bounded code step toward the first Shopping Offer journey. It adds isolated files under `src/features/offers/` and records Product decisions; it does not change Property code, database records, migrations, schedules or delivery configuration. No numbered Release 1 acceptance item is newly complete.

| Environment | Evidence | Limit |
| --- | --- | --- |
| Local runtime/database | Not exercised in this step. | No persisted offer, real actor, browser journey or fixture writes. Before/after database counts and fixture cleanup are not applicable because this step never connected to the database. |
| Staging | None. | No migration or journey claim. |
| Production | Not accessed. | No deployment or parity claim. |
| Code only | Synthetic in-memory draft/submission/review/public-read/withdrawal/renewal scenarios. | Actor capabilities are trusted test inputs; they do not establish real authentication, MFA, account suspension checks or RLS. |

## Decisions and implemented rules

Product chose **Get directions to the shop** and **hide a submitted material edit until approved** on 30 September. These choices are recorded in [the pilot brief](pinpoint-pilot-brief.md).

`schema.ts` validates the first slice's publication fields: title, benefit, exact terms, shop name, public address/point, app-owned place UUID and explicit-offset start/end timestamps. Submission normalizes times to UTC, requires start before end and a future end, and rejects unexpected fields. Length limits are implementation input bounds, not pilot targets. Partial private drafts are supported.

`lifecycle.ts` is server-only and implements pure state transitions, taking an explicit trusted clock. Submitted content is copied and frozen; later private draft edits cannot change the reviewed snapshot. Revision IDs deduplicate retries. Admin decisions record reviewer, timestamp and correction reason on the selected snapshot; an expired submission cannot be approved. Submission of a material edit removes the public approval pointer and hides the offer. Rejection leaves it hidden, preserving earlier reviews for history.

Withdrawal immediately clears public eligibility and cancels any pending revision. Delayed approval cannot resurrect a withdrawn submission; retrying an old approval does not restore its public pointer. Renewal requires a fresh revision ID, submission and review.

`readPublicOffer` exposes only the eligible confirmed content, offer/revision IDs and confirmation time. It never includes a private draft, pending payload, reviewer identity or rejection reason. All non-active results contain a status only. Approval provenance and persisted field validity are checked; malformed records fail closed. Eligibility is exactly `startsAt <= now < endsAt`, independent of a cleanup job. A single approved record tested just before/at/after the boundaries changes visibility without any scheduled mutation.

Model ownership checks reject another poster, an inactive owner, a customer lacking the separate poster capability and an admin without ownership. Model review checks reject ordinary posters and inactive reviewers. These are domain guards, **not evidence of endpoint or database security**.

## Verification

Initial focused run: **36/36 tests** in `src/features/offers/lifecycle.test.ts` passed. Final focused regression: **122/122 tests in 11 files**, covering the new model plus Property URL/detail/filters/selector/place/listings and call/showing/outbox/environment regressions. Full typecheck passed. Full lint passed with **12 existing warnings, zero errors**. `git diff --check` and new-file whitespace checks passed. No database scenario, full test suite, build or dependency audit was run for this isolated model step. Synthetic actor/offer/place/revision IDs are fixed in that test file; no real person, shop or supplied place is represented.

Commands: `npm.cmd test -- src/features/offers/lifecycle.test.ts src/features/map-discovery/discovery-page.consistency.test.tsx src/features/map-discovery/discovery-page.detail-loader.test.tsx src/features/map-discovery/discovery-page.filters-url.test.tsx src/features/map-discovery/location-selector.test.tsx src/features/places/place.test.ts src/app/api/listings/route.test.ts src/features/chat/call-actions.test.ts src/features/showings/request-showing.integration.test.ts src/features/notifications/outbox.test.ts src/lib/env.test.ts`, `npm.cmd run typecheck`, `npm.cmd run lint`, `git diff --check`.

SHA-256 source hashes from the tested uncommitted files:

| Source | SHA-256 |
| --- | --- |
| `src/features/offers/schema.ts` | `A8BB2BF9F2F27A8021774E1FAAD975B377D1DD3FC91780A2B24EAAB895744390` |
| `src/features/offers/lifecycle.ts` | `2872AFD834D050EA1EE39DE1EA5A435B57BC41BDE87A4EEFC927FB4AA79E82FF` |
| `src/features/offers/lifecycle.test.ts` | `73D457F42289A5756E1DB129F9C2E84536085C48B87191499F6E1699C933840D` |

## Next bounded step: persistence and access

1. Confirm whether first-slice poster capability is admin-granted/invitation-only or available to any eligible signed-in account. A renter/landlord role must not implicitly grant it. No enrollment rule is implemented in this step.
2. Review an additive offer/revision/poster data contract before writing the migration. Specify serialized/version-checked mutations, immutable submitted content, review history, append-only transition audit (including withdrawals and renewals), suspension behavior and an anonymous public projection that does not grant access to drafts or internal review status. Start with account ownership; organization editor scope requires an explicit follow-up contract.
3. Add server adapters deriving actors from authenticated identity, active account/poster membership and the existing `requireAdmin` membership/MFA checks. Never accept `OfferActor` flags from a form or request. Recheck authorization and use a row lock or compare-and-swap version around each transition; the in-memory retry tests do not prove concurrent database safety.
4. Before real submission/publication, validate that the UUID resolves to an allowed stored South African place; validate the public shop point/selected-place relationship, media ownership and permission to publish. Coordinate range and UUID checks alone prove none of those. The current model's fields are only one part of final publication readiness.
5. Apply the predicate to actual Feed/Map/count/search/detail/action reads, add admin unpublish and guarded directions destinations, then build poster/reviewer screens and refresh open pages across expiry/withdrawal. The model's read-time expiry does not prove browser or cache invalidation. Persistence/access is the next step; completing all of these remains several bounded steps.

Use only disposable local fixtures with delivery and schedules isolated for database checks; record guards, IDs and before/after counts. Rehearse RLS with real identities locally and in staging. Keep existing Property records, links, saved homes and filters intact. B1 and Steps 1.2–1.4 retain their documented remaining gates.

## Continuation — private intake persistence, 30 September 2026

Product confirmed eligible signed-in account enrollment. [The intake contract](pinpoint-offer-intake-contract.md) and [verification record](pinpoint-offer-intake-verification.md) document the additive local draft/submission/rejection/withdrawal access slice. The original model and its evidence above remain unchanged; the adapter does not persist approval/public eligibility yet. The new focused total is 134 tests in 12 files, plus one separate contained local scenario. Real reviewer MFA, anonymous HTTP RPC denial on the current local runtime, browser/public journeys and staging remain open.
