# Browser attempt 10 — Phase 4

Status: BB explicitly approved exactly attempt 10 for Phase 4 on 6 October 2026. It executed once and stopped at its first selector failure. Attempt 10 is exhausted; no attempt 11 is authorized. See the [verification and cleanup record](pinpoint-phase4-verification-2026-10-06.md). The scope below is retained as the approved contract; unreached checks remain open.

The Phase 4 lifecycle, purchase, private-file and notification repairs now have source tests and genuine disposable-clone API/SQL/Storage/sink evidence. The remaining browser check is bounded to the changed Phase 4 journey. It does not repeat the full Phase 3 discovery matrix.

Approved scope for exactly attempt 10:

1. Create one labelled patched Postgres/Auth/REST/Storage clone from a fresh read-only shared snapshot. Disable clone schedules/hooks/external delivery, apply only the recorded source migrations to that clone, and create captured synthetic accounts, listings, images, private objects and notification rows. Preserve shared configuration, data and `.env.local`.
2. Start one isolated Next development server with webpack, a unique `.next-pinpoint-verify-<UUID>` output directory, clone-only credentials and a fetch guard. Run one headed Chromium process using the installed Playwright skill. Block browser requests outside the app/clone; no real poster/provider contact or real email/push/queue sending.
3. Use actual sign-in controls and cookies. Verify buyer login return to the existing `/listing/<UUID>` path, saved homes and sale price, requesting interest, seller follow-up/notes, and reloaded progress on 1440px desktop and 390px phone. Capture matching persisted IDs and values.
4. Use dashboard lifecycle controls to publish/unpublish/archive/restore/duplicate/delete. Verify loaded-version conflicts, organization revocation and refusal without changed rows. Check dashboard request counts after the no-op URL repair. Private-file and notification HTTP checks use these actual cookies with controlled fixture IDs.
5. Use bounded readiness waits and one attempt ID with fresh result/artifact files. Capture hydration/bootstrap diagnostics on failure. Stop the browser journey at its first substantive failure; do not launch another browser or retry an unchanged failed driver.
6. Close the browser, stop only the captured server process tree, remove captured fixtures, then remove only resources whose UUID label matches this run. Compare shared data/configuration and source/environment hashes before and after. Record any unreached checks honestly.

Approval of this scope authorizes exactly one browser attempt, numbered 10. It does not authorize attempt 11, shared migrations, deployment, production-secret use or external contact/delivery. Clone success remains separate from staging and production.
