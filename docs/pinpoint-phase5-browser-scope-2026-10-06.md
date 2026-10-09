# Prepared browser scope — approval still required

Prepared 6 October 2026 SAST. On 7 October, BB chose **Keep the browser cap exhausted**. Attempts 1–10 remain exhausted; **no attempt 11 has been authorized or launched**. This is retained offline preparation only. Node syntax checks do not launch a browser or prove UI behavior.

Prepared sources:

- `scripts/db/pinpoint-phase5-browser-parent.prepared.mjs`: copied-app orchestration, unique attempt/result IDs, clone-only URLs, outbound request guard, first-failure stop and bounded cleanup.
- `scripts/db/pinpoint-phase5-browser-driver.prepared.cjs`: corrected continuation of the five originally unreached/failed Phase 4 groups.
- `scripts/db/pinpoint-phase5-browser-checks.prepared.cjs`: visible-panel completed-state assertions and captured analytics-ID cleanup.

Both parent and driver fail closed unless explicitly supplied the future attempt-11 opt-in. Setting that variable is an execution safeguard, not permission from BB. The clone parent must additionally pass `browserAttempt: 11`; the current recovery harness does not supply it. Do not launch the driver, Playwright, Chromium, a different browser or any substitute UI rehearsal until BB extends the cap.

## Proposed single bounded attempt

One run, fresh attempt/result UUIDs, 1440px desktop and 390px phone, patched isolated clone and five groups:

1. Native buyer sign-in returns to the exact sale UUID. After reload, exactly one visible Purchase progress section contains Property Saved and Sale Agreed rows labelled **Completed**, with the correct completed-stage count.
2. Saved homes contains that listing. Native viewing interest persists once, does not claim Viewing Scheduled completed, and phone reload preserves the previously stored milestones.
3. Native seller follow-up notes persist after reload.
4. Dashboard lifecycle controls persist unpublish/publish/archive/restore/duplicate/delete; retained source images and sale type/price are checked in SQL. Unchanged filters do not repeatedly request dashboard RSC responses.
5. A stale loaded dashboard refuses a native lifecycle mutation without changing the newer database row.

Stop at the first substantive failure. No automatic retry, new UUID retry or additional browser run. Capture diagnostics/screenshot/driver hashes and archive the exact executing source. Blank map style and placeholder seed photos remain declared substitutions, with no live MapTiler/geocoding claim.

The driver now checks actual completed state inside the visible panel rather than ambiguous whole-page Sale Agreed text. Before/after analytics IDs are captured on the exclusively owned clone; cleanup deletes only the new captured IDs and verifies the original ID list. The parent stops the app before final analytics cleanup. It validates the exact Temp snapshot path and dependency junction target, removes the junction nonrecursively, then removes only that snapshot. Parent integration, cleanup and selectors are prepared source only; they have not been rehearsed after these changes.

## Remaining browser gates after this bounded scope

This single proposal does **not** close every Phase 3/4/5 exit criterion. Cookie organization revocation, private-file management, inbox privacy/read state, cross-card progress refusal, saved-home remove/reload, rental/direct-link preservation and Phase 3 response/URL/history/keyboard/stale-request/discovery checks still require separately scoped evidence. Integrated current Shopping/Tourism/Event/Services MFA/publication/removal journeys need fresh evidence where the manifest records source drift. Development hydration diagnosis remains open independently of the selector correction. A passed partial continuation must not be recorded as full Phase 5 completion.

BB owns cap approval; Codex owns executing the exact approved scope and preservation checks. Target access, real external maps and deployment approval are separate gates.
