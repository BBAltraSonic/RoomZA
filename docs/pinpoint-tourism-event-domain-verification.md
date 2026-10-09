# Tourism/Event domain foundation — 3 October 2026

Owner: Build. Environment: source-only checks in the preserved RoomZA working tree. No category migration, fixture write, exposed endpoint, screen or complete journey exists at this checkpoint. The preceding [Property content-save checkpoint](pinpoint-property-save-verification.md) completed its five real browser groups and fresh isolated CLI checks before this implementation began.

## Implemented boundary

`src/features/entries/schema.ts` defines separate `tourism` and `event` categories and the minimum directions-oriented content: title/description, venue name, stored place UUID, public address/coordinates and exact offset-bearing start/end times. Submission trims text, normalizes times to UTC and requires a strictly later, future end. Weekly recurrence, caller capability fields and media URLs are rejected. SAST formatting uses `Africa/Johannesburg` explicitly. Temporal state is scheduled before start, available at start and unavailable from the exact end; no job is needed for the classification.

`access.ts` derives identity from `requireUser` and reviewer permission from the existing current admin/MFA guard. A separate category enrollment must match the authenticated account and category and have no revocation. Shopping Offer enrollment and Property personas confer no new category capability. Approval additionally requires separate revision-bound place/authority evidence and an explicitly image-free state from a cookie-scoped RPC. These two **planned** reads (`pinpoint_entry_poster` and `pinpoint_entry_publication_evidence`) do not exist in a migration yet. Missing/error/malformed results fail closed; the module is not wired to an application route. No caller supplies an actor, canPost/canReview boolean or service-role write.

`lifecycle.ts` adds private draft/save/submit/review/withdraw transitions with expected versions and a `PT409` domain conflict. Submissions freeze content snapshots. Decisions append separate immutable review records rather than rewriting submissions. Saving a private draft preserves the confirmed snapshot; submitting a material edit hides it, and rejection cannot restore it. Withdrawal clears pending/confirmed references without deleting history, so delayed approval cannot revive withdrawn content. Renewal needs a fresh revision and review. Functions obtain current server capabilities themselves; internal records must come from a trusted loader, never request JSON.

The confirmed-snapshot helper returns only approved content with matching evidence and valid review timing. It carries no reviewer identity or private evidence IDs. **It is not a public eligibility adapter:** current poster/reviewer/evidence eligibility still needs database enforcement and fresh reads. Scheduled content is retained as a distinct temporal state, avoiding an Offer active-only filter for future Events. No Event upcoming/cutoff or pause/resume rule has been assumed. The Event cutoff question was sent asynchronously and has no recorded answer yet.

## Observed checks

- Three focused files pass **53 tests**. Cases cover incomplete/invalid/reversed dates, UTC normalization/SAST formatting, exact boundaries, unsupported recurrence/claims/media, category capability isolation, non-permanent/unconfirmed/suspended guard denial, revoked/foreign capability results, ordinary-account MFA denial, missing or unrelated place/authority evidence, immutable history, stale owner/reviewer versions, pending edit privacy, rejection, withdrawal, renewal and ended approval.
- Full typecheck passes. Its first attempt identified possibly missing array elements in the new test fixtures; explicit fixture existence checks fixed those diagnostics.
- Targeted lint on all six new files passes; `git diff --check` passes.
- The full default suite passes **1,212 tests across 222 files**, with two opt-in skips, in 148.45 seconds. [Source hashes and observed results](pinpoint-tourism-event-domain-source-evidence.json) retain the environment boundary. Original Offer/Property source/migration hashes match the preceding Property checkpoint; that earlier build remains evidence for its own source only.

Auth, RPC and admin/MFA dependencies are mocked in these tests. They are source contract evidence, not persisted authorization, genuine Auth/MFA, HTTP 409, browser, shared-local, staging or production proof. This slice created no identities/data or external delivery, so no fixture cleanup was required. Original Shopping Offer/Property contracts are preserved.

## Next checkpoint

**Subsequent private persistence checkpoint:** [separate category enrollment and intake](pinpoint-entry-intake-verification.md) now passes twelve real Auth/REST/RPC/SQL groups on the patched disposable clone, plus the official read-only advisor query after three covering-index additions. Its guarded cleanup preserves exact baselines and original contracts. `pinpoint_entry_poster` is now backed by that clone-only migration. No review/decision persistence, planned publication-evidence read or application route is established by this pass.

Next connect the cookie-scoped private adapter and then review/correction persistence with genuine MFA checks. Separate venue/place and publishing authority evidence must be backed by actual revision-specific admin records before approval; synthetic fixtures cannot establish real business permission or supply. Keep the original Offer schema/functions and Property contracts intact. Historical source-only statements above describe this record's initial checkpoint.

Shared runtime correction, private Storage, stored-place/sale journeys, staging, discovery/Map integration, real supply and authorized pilot remain open. Release counts stay **2/48 acceptance items**, **0/3 complete new-category journeys**.
