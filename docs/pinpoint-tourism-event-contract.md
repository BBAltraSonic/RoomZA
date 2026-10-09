# Tourism and Event first-slice contract — 2 October 2026

**Current decision addendum, 3 October 2026:** the [six-phase execution plan](pinpoint-completion-plan-2026-10-03.md) and [Phase 1 ledger](pinpoint-phase1-ledger-2026-10-03.md) supersede the undecided Event/pause language and older implementation status below. Events are poster-style Specials, publicly visible from approval until the exact end, with Upcoming before the start; there is no separate earlier publication cutoff. Pause/resume is excluded from this implementation. Tourism retains exact SAST start/end availability stored as UTC, venue directions, separate revision-bound poster/reviewer evidence, hidden material submissions until reapproval and reviewed renewals. Private intake/correction has recorded clone evidence; additional workspace/publication source exists but its complete publishing-to-public browser journey remains unverified. Three top-level tabs are Specials, Property and locally enabled Services. No production/pilot completion follows. The original dated contract and checks below are retained as historical evidence.

Status: the [source-only content/date and lifecycle foundation](pinpoint-tourism-event-domain-verification.md) is implemented. No Tourism/Event persistence, public screen or completed journey is claimed. The original Shopping Offer schema/lifecycle and Property contracts remain the existing baseline.

## Recorded product decisions

- Release 1 includes Tourism and Events alongside Shopping Offers and Property under the South Africa-wide place selector.
- Tourism represents continuing experiences with availability windows.
- Tourism and Event availability uses continuous date ranges only. Weekly recurrence is excluded.
- Ranges use exact start/end times in SAST, selected on 2 October. Normalize to UTC for storage/comparison; display the SAST date and time. An entry is available from its start instant until immediately before its end instant (`startsAt <= now < endsAt`). Whole-day inclusive date ranges are excluded.
- The primary visitor action for both is directions to the venue, as selected by the user on 2 October. Enquiry, booking and ticket links are not the chosen primary action.
- Posters maintain their entries; admins confirm publication. Real supply, permission and place provenance are required separately from synthetic verification.
- Submitting a material edit hides the entry until the new version is approved, selected on 2 October. Rejection does not restore a superseded public version. Material changes and renewals return to review.

## Venue and directions requirements

A published action must use the approved public venue/address and checked coordinates in an app-owned stored South African place. Venue permission and publishing authority require their own supplied evidence; public venue information alone does not establish poster authorization.

Directions must be generated from the verified coordinates using a fixed destination host, following the existing Shopping Offer action pattern. Caller-supplied redirect destinations are not accepted. A fresh server eligibility read precedes the action. An ended, withdrawn, pending or otherwise ineligible entry has no actionable destination, even when schedules stop. Open pages must recheck availability and handle failure before navigation. These are proposed verification requirements, not evidence of a built category flow.

## Lifecycle decisions and first-slice boundary

The exact-time answer unlocks content/date contracts. Reject missing/reversed bounds and weekly recurrence. Availability and directions stop at the exact end instant even when schedules are inactive. Public display must label SAST; synthetic fixtures do not establish real venue opening hours.

Tourism/Event pause and resume behavior remains unresolved. No automatic restore of an older approved revision, renewal shortcut or pause capability is assumed. The pivot brief already requires material changes and renewals to return to admin review; any resume behavior must fit the approved version and withdrawal rules.

## Next reviewable build

The category content/date contracts and isolated server-only draft, submit, review and withdrawal foundation pass 53 source tests. [Private category intake](pinpoint-entry-intake-verification.md) now passes twelve real patched-clone Auth/REST/RPC/SQL groups and the scoped official advisor query, with exact baseline cleanup. The [cookie-scoped server adapter](pinpoint-entry-adapter-verification.md) raises focused entry coverage to 88 tests; typecheck and targeted lint pass. No route calls it yet. Category enrollment has persistence, while review/decisions and revision publication evidence remain separate dependencies. Pause/resume is excluded while its rules remain undecided. Preserve the Offer tables/functions and Property `listingId`, saved homes and rent/buy state. Next add private review/correction with genuine MFA checks, without treating Shopping Offer capability or confirmation as venue authorization.

The initial checks must cover invalid/reversed bounds, exact boundary behavior, inactive or unauthorized posters, other-poster isolation, ordinary-account approval denial, immutable revisions, stale-version conflicts and hidden unapproved content. Persistence and real Auth/MFA/browser checks follow in their own contained clone step. The clone-restore segmentation fault recorded in the report follow-up remains an unresolved environment finding; one later successful restore does not establish its cause or fix.

No fixture here represents real supply or permission. Shared-runtime correction, staging, Property/B1 gates and launch/pilot authorization remain open.
