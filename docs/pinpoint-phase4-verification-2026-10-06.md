# Phase 4 — Property and platform implementation

Status on 6 October 2026 SAST: scoped repairs are implemented; focused source and disposable-clone API checks pass. Phase 4 is **not fully verified**. Explicitly approved browser attempt 10 stopped at its first selector failure. No further browser attempt is authorized. Phase 3 remains incomplete independently.

The [kickoff baseline](pinpoint-phase4-baseline-2026-10-06.json) preserves the pre-existing dirty tree. Frozen Phase 1 scope and completed rental/content-save audits remain retained. Expanded Services booking, conversation and provider tools remain deferred by the ledger.

| Task | Implemented behavior and proof | Remaining proof |
| --- | --- | --- |
| 4.1 Property writes | Publish/unpublish/archive/restore/delete/duplicate now use trusted, active-session and exact-version checks. Current organization owner/admin authority is required even for the creator. Clone checks cover success, stale/foreign/revoked/agent/suspended refusal, logout, readiness, active applications and sale/image preservation. | Native dashboard/editor controls and cookie-based organization revocation were not reached. |
| 4.2 Purchase | Repeat interest is idempotent; seller status/private notes use loaded versions; progress merges under row locks. Viewing requests no longer mark viewings scheduled. Sale cards load own persisted progress and guard cross-card responses. Sale dashboard prices omit rental suffixes. Genuine Auth/API/SQL checks cover saved homes, interest, seller privacy, stale conflicts and concurrent progress. | Genuine buyer sign-in returned to the sale URL, but browser saved-home, viewing, seller and desktop/phone reload assertions did not complete. Milestone display remains unverified in browser. |
| 4.3 Private files/access | Signed reads check active session, private bucket/owner path and current sharing/privileged access. Object/array relations are normalized. Privileged access fails if its audit insert fails. Real PDF bytes, owner/share signed access, anonymous/foreign/public denial, revoked sharing and forged session checks passed. | Cookie management/organization flows were not reached. Privileged audit-insert failure has source inspection rather than new runtime proof. |
| 4.4 Notifications | Recipient/read actions were retained and exercised. Delivery accepts an isolated sink adapter; default delivery remains unchanged. Digest HTML escapes user content. Genuine loopback HTTP delivery, recipient privacy, read persistence and sent timestamp passed. | Real-cookie inbox checks were not reached. No external email/push/queue delivery was exercised. |
| 4.5 Dashboard/runtime | Filters replace URLs only when query parameters change; source tests cover no-op render and changed search. Evidence records shared migration/catalog/ACL/job/runtime differences. | Browser request-count observation remains open. Integrated build/parity belongs to Phase 5. |

## Source and clone evidence

The two new source migrations are `20261006180626_pinpoint_property_lifecycle.sql` and `20261006181312_pinpoint_phase4_platform.sql`. They were applied only to disposable clones. Ordinary write revokes remain preserved. Lifecycle/purchase primitives use security invoker, an empty search path and service-role execution only. The narrow active-session helper uses security definer to check/lock Auth rows, with an empty search path and service-role execution only.

Deletion and image-row removal retain Storage bytes because duplicates can reference the same paths. Surviving listings keep their images; unreferenced objects can remain. Garbage collection is not implemented.

- Final focused suite: **45 tests in 11 files passed**; TypeScript passed. Selected lint: zero errors, one existing internal-navigation warning in `use-favorites.ts`.
- [Successful clone evidence](pinpoint-phase4-local-pinpoint-release-92afa340-4f37-4f26-9184-f6dd0170c570-evidence.json): six lifecycle groups plus a platform group containing three actual Auth/REST/Storage/HTTP-sink tests passed. Captured fixtures restored the clone baseline; shared snapshots and original permissions were preserved. Containers/network/database volume were removed then; the omitted Storage-volume cleanup was completed in the follow-up below.
- Runtime action tests use genuine clone tokens/persistence with application Auth/Next adapters injected. These are not browser-cookie proof. Storage bytes and sink requests are actual HTTP checks.
- Shared Postgres remains `17.6.1.111`; the clone used pinned patched `17.6.1.113`. Clone cron/schedules and delivery hooks were isolated; Storage used a separate disposable volume. Shared jobs/configuration remained unchanged. Clone proof is separate from shared-local, staging and production.
- [Implementation preservation/quality](pinpoint-phase4-implementation-preservation-2026-10-06.json) records current hashes, changed baseline files and protected environment/frozen files.

## Approved browser attempt 10

BB explicitly approved exactly attempt 10 for the [guarded Phase 4 scope](pinpoint-phase4-browser-approval-2026-10-06.md). It ran once against a copied source snapshot with an isolated webpack server, headed Chromium, native sign-in and clone-only credentials.

[Browser result](pinpoint-phase4-attempt10-e2b33777-df2f-4c77-ad49-3762be8e1295.json), [screenshot](pinpoint-phase4-attempt10-e2b33777-df2f-4c77-ad49-3762be8e1295-failure.png), [app log](pinpoint-phase4-attempt10-e2b33777-df2f-4c77-ad49-3762be8e1295-app.log).

The buyer signed in and returned to `/listing/1c7b892c-36b8-4864-b720-b3697841f811`. The first group then failed: exact-text `Sale Agreed` resolved to two labels. No complete browser group passed. This selector failure does not establish whether persisted progress rendered correctly. No page errors or blocked requests were captured; no network/CORS root cause is established. Phone, saved homes, seller, lifecycle, dashboard counts, organization, private-file and inbox browser checks were not reached.

[Parent evidence](pinpoint-phase4-local-pinpoint-release-47b7ec62-15d8-45b1-b407-6e822e842abd-evidence.json) remains failed. Immediate temporary-app removal hit `EPERM`; subsequent guarded cleanup unlinked its verified dependency junction and removed only the exact app snapshot, preserving workspace dependencies. Four browser analytics rows remained in the clone baseline (88 versus 84), so fixture restoration is not claimed for this run. Shared snapshots matched. Final inventory also found four Phase 4 Storage volumes omitted by the harness cleanup. Each exact volume was label-checked, confirmed unused and removed; the harness now removes its Storage volume. Its cleanup change passed syntax verification, without another clone/browser run. The entire labelled clone resources are now disposed. [Cleanup follow-up](pinpoint-phase4-attempt10-cleanup-2026-10-06.json) records final resource checks and those removals; historical results remain unchanged.

## Continuation boundary

Attempts 1–10 are exhausted; no attempt 11 is authorized. A future corrected driver must scope assertions to a specific visible progress panel and check completed state rather than duplicate labels. Before any separately approved browser run, capture browser-created analytics IDs and unlink the verified snapshot junction before removing the app. Preserve historical results and executing-driver hashes.

Remaining browser gates are listed above. Phase 5 integrated tests/build/security/parity and Phase 6 release preparation remain open. No shared migrations/reset/configuration edits, deployment, production-secret use, real contact/delivery, commit, push or PR occurred.
