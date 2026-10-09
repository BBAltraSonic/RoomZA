# Next-session handoff — 2 October 2026

**Historical handoff, superseded by [the current 3 October handoff](pinpoint-handoff-2026-10-03.md).** Property browser/build checks below were completed afterward; resume from the current record. The original prompt is retained for context.

Copy the prompt below into the next session.

---

Continue the existing **Finish Pinpoint Release 1** goal in `C:\Users\BB\Documents\RoomZA`, carefully, one reviewable verified slice at a time. Read the goal objective first:

`C:\Users\BB\.codex\attachments\b002bf9c-5ced-49e8-a06d-30a45a65a293\goal-objective.md`

Then read the first progress section of `docs/pinpoint-pivot-plan.md`, its linked evidence, and these current records:

- `docs/pinpoint-property-save-verification.md`
- `docs/pinpoint-property-save-local-evidence.json`
- `docs/pinpoint-property-save-browser-login-failure-evidence.json` (preserved latest failed browser run)
- `docs/pinpoint-organization-access-verification.md`
- `docs/pinpoint-tourism-event-contract.md` and `docs/pinpoint-pilot-brief.md`
- `docs/pinpoint-b1-browser-verification.md` and `docs/pinpoint-release-cli-inbox-evidence.json`

Inspect uncommitted work once and preserve it all. Read applicable AGENTS.md and installed Next.js guides before code; this checkout uses Next 16.3.7. Use relevant Supabase/browser skills when needed. The goal is still active/incomplete: **2/48 acceptance items closed, 0/3 complete new-category journeys**. No commit, PR or deployment was made. Keep progress first in the pivot plan and distinguish source, disposable-clone, shared-local, staging and production evidence.

## Start here: finish the Property content-save checkpoint

Organization access passed six real Auth/REST/RPC/SQL groups on a disposable patched clone. Existing table revokes correctly deny direct listing UPDATE, but exposed incompatible application saves and the legacy `delete_listing_checked` invoker RPC's row lock. Preserve those revokes; deletion remains unrepaired.

The content-save repair is implemented in:

- `supabase/migrations/20261002162631_pinpoint_property_save.sql`
- `src/features/listings/actions.ts`
- `src/features/listings/listing-form.tsx`
- `src/app/dashboard/listings/[id]/edit/page.tsx`
- `src/features/listings/update-listing.test.ts`

`pinpoint_property_save` is security INVOKER, empty search_path, service-role-only execute. It checks current profile/persona/suspension and ownership or active owner/admin membership, locks rows, accepts content fields only, and compares expected `updated_at`. The server derives the actor from the real session. Stale versions raise PT409; the action shows a conflict without retry/overwrite. The form retains the returned timestamp. The edit page now passes sale type/price; without a local MapTiler key, stored address/coordinates remain in the form. Publication, deletion, archive/restore and duplication are outside this repair. The new migration is **clone-only**, not applied to the shared database.

Eleven real HTTP/SQL groups passed, including ordinary-JWT RPC denial, valid owner/admin saves, stale HTTP 409, simultaneous same-version saves with exactly one 200/one 409, protected-field rejection, foreign/renter/revoked denial and owner recovery.

The latest browser run **ended with exit1**, recorded `2026-10-02T17:12:28.314Z`; it is **not a complete pass**. All eleven HTTP/SQL groups repeated successfully, plus three native cookie/browser groups:

1. Desktop owner Save draft persists and reloads.
2. Admin save persists; stale owner gets a conflict and keeps unsaved input.
3. Phone sale save/reload at 390×844 preserves sale type, price 300000 and stored location without horizontal overflow.

The next fixture login stayed at `/auth` rather than `/dashboard` for 120 seconds. Forged-denial and revoked-admin cookie groups remain open. No outside browser requests or browser errors were recorded. All captured accounts, organizations, Property/private-message fixtures and labelled clone containers/network/volume were removed; shared counts, fingerprints, functions/security and configuration matched. No verification process from that run remains active. Screenshots include `docs/pinpoint-property-save-phone.png` and `docs/pinpoint-property-save-conflict.png`.

**Correct the harness before rerunning:**

- Diagnose the actual failing Auth response/log. The login helper currently accepts any `Next-Action` POST; match the real sign-in action and its result/redirect. Presence actions can also POST. This is a hypothesis about the wait, not a diagnosed login cause.
- Forged-cookie requests currently use raw PostgreSQL timestamp text. Supply valid ISO datetime text, e.g. `JSON.parse(sql("select to_json(updated_at) ..."))`, so validation reaches authorization. Assert exact error `Listing not found or access denied.`, not merely `success: false`. Otherwise a timestamp validation failure could falsely count as access proof.
- Keep complete valid form fields and forged actor claims; shipping code must continue deriving the actual actor from the session. Complete foreign/agent and revoked-admin cookie denial with persisted unchanged-row checks. Do not weaken permissions to pass the harness.

Temp harness files exist but may need reconstruction if Temp is cleared:

`C:\Users\BB\AppData\Local\Temp\pinpoint-org-access-save-browser-clone.mjs`

`C:\Users\BB\AppData\Local\Temp\pinpoint-org-access-save-browser-check.mjs`

`C:\Users\BB\AppData\Local\Temp\playwright-test-pinpoint-property-save.js`

After correcting/inspecting them, run sequentially with the existing containment guards:

```powershell
$env:PINPOINT_ORG_ACCESS_LOCAL='1'
$env:PINPOINT_CLONE_TASK_PATH='C:\Users\BB\AppData\Local\Temp\pinpoint-org-access-save-browser-check.mjs'
node "$env:TEMP\pinpoint-org-access-save-browser-clone.mjs"
```

The parent uses pinned Postgres 17.6.1.113, a labelled internal Docker network, loopback gateway 55431 and app 3116; schedules/external delivery are isolated. It captures IDs/baselines and performs guarded cleanup. Inspect these guarantees before any fixture writes. Preserve failure evidence before overwriting rolling JSON. Docker operations may require sandbox escalation.

Final-source focused tests pass 24; typecheck and targeted lint pass. The full suite passed 1,158 tests/219 files with two opt-in skips **before** the final location/sale fixes and additional test. Rerun the full suite for final source; do not claim a newer count without observing it.

Fresh Property-repair clean install/build/budgets/production audit is prepared, **not run**. `scripts/db/release-clone.local.mjs` now includes the eleventh clone migration, Property save. Temp task `pinpoint-release-check.mjs` additionally checks the edit route. Run after browser completion:

```powershell
npm test
$env:PINPOINT_RELEASE_CLONE_LOCAL='1'
$env:PINPOINT_CLONE_TASK_PATH='C:\Users\BB\AppData\Local\Temp\pinpoint-release-check.mjs'
node scripts/db/release-clone.local.mjs
```

Do not change source/config/scripts during the CLI snapshot. Verify source hashes and cleanup; preserve successful rolling `docs/pinpoint-release-cli-local-evidence.json` as `docs/pinpoint-release-cli-property-save-evidence.json`. Earlier inbox CLI success covers its earlier snapshot only.

## Then move to Tourism/Event implementation

These user decisions are settled; do not ask them again:

- Tourism: continuing experiences with availability windows.
- Both categories: continuous ranges only, no weekly recurrence.
- **Exact start/end times in SAST**, normalize/store UTC, display SAST; availability uses `start <= now < end`.
- Primary visitor action: **directions to the venue**.
- **Submitting material edits hides until reapproved**; rejection does not restore an older public version. Renewals require review.
- Offers may have no image. Publishing permission is separate: poster confirmation plus actual admin evidence, with separate place/media/authority checks.

No Tourism/Event category implementation or complete journey exists yet. Next build the smallest content/date and server-only, version-checked draft/submit/review/withdraw domain slice. Cover invalid bounds, exact boundaries, unauthorized/inactive posters, ownership isolation, ordinary-account approval denial, immutable revisions, hidden pending content and stale conflicts. Use trusted session capabilities, not caller booleans. Follow with separate persistence/real Auth/MFA/browser evidence. Pause/resume and any distinct Event publication cutoff/upcoming behavior remain unresolved; avoid inventing them or blindly suppressing upcoming Events with an active-Offer predicate. Real venue, place provenance and permission are not established by fixtures.

## Preserve completed work and environment boundaries

B1 inbox already passed five real cookie/browser/REST/SQL groups (eight producer events, phone/desktop reload, denied inserts/foreign mutation, own read state, tied-timestamp paging and anonymous denial), with complete cleanup. Inbox CLI passed fresh install/build/budgets/audit, 82 routes, 0 production vulnerabilities. Read-state migration is clone-only. Do not repeat this or completed Offer/organization audits without a changed requirement or new failure. Shopping Offers have substantial poster/admin/public/report evidence documented in the pivot; their full release journey still remains open.

Shared Postgres remains affected 17.6.1.111 with TOTP disabled. A patched disposable clone pass does not repair or establish shared/staging/production success. An earlier isolated Offer restore signal 11 remains unexplained despite a successful retry. Do not trigger known crash probes on shared data.

Preserve Property URLs, listingId, saved homes, rent/buy state, original Offer schema/lifecycle and all existing work/data. Never reset, recreate or blindly upgrade the shared stack; deploy; use production secrets locally; contact posters; or launch/outreach/pilot without separate authorization. Isolate delivery and schedules before fixtures, capture identities, clean dependents in order, and verify exact before/after baselines. Property 1.2–1.4, private Storage/signed URLs, controlled sale/stored-place journeys, shared-runtime correction, staging, cross-category discovery and real supply/pilot gates remain open. Continue useful independent work if one gate blocks; never mark the goal complete with required work remaining.

At each checkpoint report changes, observed verification/environment, cleanup, remaining gates and the next small step. Update the focused record and first progress section before moving on.
