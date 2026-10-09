# Private Tourism/Event intake — 3 October 2026

Environment: a labelled, disposable logical clone using pinned Postgres 17.6.1.113, real GoTrue sessions and PostgREST. The shared Postgres 17.6.1.111 stack was read-only. This is private persistence evidence, not review/MFA, browser, publication, shared-runtime, staging or production acceptance.

## Implemented boundary

The CLI-generated `20261003025344_pinpoint_entry_intake.sql` adds separate `(user_id, category)` enrollment, private entries, immutable revision snapshots and immutable intake events. Neither Property personas nor Shopping Offer enrollment grants Tourism/Event access. Its only existing dependency is the general `private.pinpoint_intake_eligible` confirmed-account/current-session/suspension/current-policy guard; the existing Offer schema, capabilities and functions are preserved.

Authenticated invoker wrappers expose category enrollment, current poster capability and version-checked create/save/submit/withdraw. Purposeful private definer helpers read protected Auth/session records and perform controlled writes under category-enrollment and entry locks. They derive identity from `auth.uid()`, check current eligibility again after waiting, enforce exact ownership/category and reject caller actor/capability/publication fields. Empty search paths and explicit execute ACLs apply. No direct INSERT/UPDATE/DELETE grant or anonymous read exists. RLS restricts ordinary reads to the eligible owner; revocation is read from the current database rather than a stale JWT claim. Service-role RPC execute is denied.

Draft validation accepts only the minimum category content, trims text and canonicalizes offset-bearing times to UTC milliseconds. Submission additionally requires complete content, a strictly later future end and catalogue geometry consistent with the stored place UUID. Geometry consistency is not venue/provenance/authority evidence. Submission freezes a revision; editing the draft does not change that snapshot. Withdrawal clears pending state without deleting history. Renewal requires a fresh revision. Stale versions return real HTTP 409/PT409 and cannot overwrite concurrent work.

This packet has **no review/reject/approval/evidence/public projection operation**. The source domain's review transitions and planned publication-evidence read remain unwired. Revision-specific poster confirmation and separate actual admin place/media/authority evidence must precede publication persistence. No upcoming Event cutoff or pause/resume behavior is assumed.

## Observed checks

The first clone run passed three groups, then stopped because a direct-update harness probe omitted a WHERE clause. The database returned `21000` before authorization. [Preserved failure evidence](pinpoint-entry-intake-filter-failure-evidence.json) includes successful cleanup; no permission change was made to accommodate the harness. The corrected probes use valid payloads and captured fixture filters.

[The final indexed intake run](pinpoint-entry-intake-complete-evidence.json), recorded **2026-10-03T03:12:45.680Z**, passed twelve real Auth/REST/RPC/SQL groups through the saved repository harness. The [pre-index pass](pinpoint-entry-intake-pre-index-evidence.json) is retained separately. Final intake and advisor evidence contain the same migration SHA-256:

1. Anonymous/service-role execute denial and no anonymous table reads.
2. Explicit, idempotent category enrollment, independent of Offer enrollment and renter persona.
3. Current Auth record denial for unconfirmed/anonymous accounts; a genuine previously issued JWT is denied after sign-out deletes its session.
4. Owner persistence in both categories, normalized UTC dates and direct-write revokes.
5. Foreign/unenrolled reads and writes denied; category reassignment denied.
6. Forged capability/publication fields and malformed content rejected with full-row equality.
7. Incomplete/reversed/equal/ended/unrelated-place submissions denied without revision residue.
8. Actual stale HTTP 409 and simultaneous saves with one 200/one 409.
9. Both category revisions immutable, private draft edits isolated, repeated/pending submission denied; UPDATE/DELETE triggers also deny privileged history mutation.
10. Version-checked withdrawal, retained history and renewal with a new revision.
11. Existing JWTs denied after category revocation or account suspension; other category access remains independent before suspension.
12. No review/publication endpoint; explicit function ACLs/empty search paths and RLS verified in the actual catalogue.

Four synthetic accounts, two entries, three revisions and one synthetic discovery place were captured and removed. Immutable history triggers were disabled only for guarded cleanup on the labelled clone, in one transaction, and restored. Clone counts/baselines and both original/new function/security configuration matched afterward. Shared counts, Property fingerprints, functions, policies, schedules and container configuration matched exactly. Label-checked containers, network and volume were removed. No crash markers or delivery occurred. Fixtures do not establish real supply or venue permission.

The [official CLI v2.109.0 advisor SQL](https://raw.githubusercontent.com/supabase/cli/v2.109.0/apps/cli-go/internal/db/advisors/templates/lints.sql) ran in a read-only transaction on a separate labelled patched clone, with `pgrst.db_schemas=public` supplied explicitly for exposure checks. This was the CLI's embedded query, not a hosted advisor or CLI connection to the shared stack. Its first run found three composite foreign keys without covering indexes; [that failure](pinpoint-entry-advisors-index-failure-evidence.json) is retained. Covering indexes were added and [the final advisor check](pinpoint-entry-advisors-complete-evidence.json), recorded **2026-10-03T03:10:21.611Z**, passed: no new-entry security warnings/errors or uncovered foreign keys. Eight unused-index information notices are expected for fresh empty tables; no production usage/performance claim follows. The copied database still has 29 warnings elsewhere, so this is not an overall database all-clear. No identities or data were created by the advisor query, and clone/shared cleanup/baseline checks passed with no crash markers.

Both saved harness files pass Node syntax and targeted ESLint checks. `git diff --check` passes. The source domain's preceding full suite passed 1,212 tests/222 files with two opt-in skips, plus typecheck and focused lint. Its source evidence and preceding Property build remain evidence for their respective snapshots; no new build is claimed here.

Reproduce the private intake checks only after reviewing containment and local demo-key guards:

```powershell
$env:PINPOINT_ENTRY_INTAKE_LOCAL='1'
node scripts/db/entry-intake.local.mjs
```

The saved parent accepts its exact repository fixture checker by default, or a name/path-guarded Temp task for bounded follow-ups. It applies the new migration only inside the labelled clone after restoring and checking the original schema; shared migration history is unchanged. Docker access may require sandbox escalation. The advisor query's official URL/hash and independent results are retained in its evidence.

## Next checkpoint

The private intake packet is complete in its disposable-clone environment. Next connect a cookie-scoped private persistence adapter and reviewer read/correction path with genuine MFA verification. Keep publication evidence/approval, private screens/browser persistence and the full category-to-visitor journeys as separate dependent packets. Counts remain **2/48 acceptance items** and **0/3 complete new-category journeys**.
