# Private entry server adapter — 3 October 2026

Environment: source checks; the underlying [private intake database contracts](pinpoint-entry-intake-verification.md) have separate patched-clone Auth/REST/RPC evidence. No application endpoint, cookie/browser flow or complete journey is claimed by these unit tests.

`src/features/entries/intake.ts` uses the existing account guard and cookie-scoped Supabase client. It validates separate category enrollment, strict create/save/submit/withdraw commands and a minimal owner-only draft read. The live database retains the authoritative eligibility/ownership/version check under locks. No actor, capability, approval command or service credential enters the mutation arguments. Submission accepts a fresh revision ID and submits the stored draft; caller content on submit is rejected. Exact category/identity/target and returned version/pending revision are checked before an acknowledgment is accepted. RPC errors, including PT409, propagate without retry or reload.

The owned read has explicit session-owner, category and entry-ID filters as well as database RLS. It validates the returned scope and content and returns a frozen minimal draft DTO without raw owner identity. Denied/error data cannot become a blank draft. `intake-contract.ts` shares strict enrollment/command/result/row schemas; the existing domain capability read now reuses the same enrollment parser. Publication evidence remains a planned, unwired fail-closed dependency.

## Observed verification

All four entry test files pass **88 tests**: the prior 53 domain/access tests plus 35 new adapter cases. New checks cover non-permanent/unconfirmed/current-account denial, another identity/category or revoked enrollment, injected actor/capability/publication arguments, unused submission content, wrong command/version, exact revision acknowledgments, withdrawal idempotency, malformed/mismatched result fields, owner DTO isolation, RLS-hidden null reads and denied/error reads. The exact PT409 object is retained, with one RPC and no automatic retry.

Full typecheck and targeted lint pass. The full default suite passes **1,247 tests across 223 files**, with two opt-in skips, in **143.99 seconds** (`npm.cmd test -- --maxWorkers=2`, exit 0). These adapters are not wired to a route, so no persisted cookie or browser proof is added. No new fixtures, credentials, schedules or delivery were used in this source packet; the preceding intake and advisor clone cleanups are recorded separately. The original Offer schema/lifecycle and Property contracts remain preserved.

[Observed counts and source hashes](pinpoint-entry-adapter-source-evidence.json) include eight original Offer/Property contract hashes matching the initial entry-domain and preceding Property checkpoint. Earlier source evidence remains historical and has not been overwritten.

## Next packet

Implement private pending review/read and correction persistence with immutable decisions and live admin/MFA enforcement, then check the new category review operations using real Auth MFA on the disposable clone. Publication approval remains dependent on revision-specific poster confirmation and actual admin place/media/authority evidence. Follow with private poster/reviewer screens and genuine cookie/browser journeys. Event upcoming/cutoff/pause rules, shared runtime, staging and pilot gates remain open. Counts stay **2/48**, **0/3**.
