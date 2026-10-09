# Phase 2 verification — Tourism and Event Specials

**Scope:** local implementation and contained verification under the [six-phase plan](pinpoint-completion-plan-2026-10-03.md). **Status:** verification in progress; the final browser and preservation results are recorded below once complete. No shared migration or deployment is included.

## Resulting behavior

Tourism and Events are selectable types inside Specials. The existing private category workspaces save partial drafts, retain unsaved text after a stale HTTP 409, submit immutable revisions and show correction feedback. Posters confirm publishing permission for the submitted revision. Cookie-scoped reviewers supply authority and venue/location/date evidence, with genuine MFA and current membership/account checks enforced again by the database mutation.

Approval creates an immutable reviewed snapshot and a public projection. Saving a private draft retains the approved snapshot; submitting its replacement hides publication. Rejecting that replacement never revives older content. Renewal requires a fresh submitted revision, permission and review. Withdrawal and versioned reviewer removal hide public content.

Tourism is public only within `start <= database now < end`. Approved Events are public from approval to the exact end, labelled Upcoming before start and Available now afterward. Input and display use SAST, including seconds; persisted timestamps use UTC. Public feed/count/detail and venue directions recheck current eligibility. Open screens refresh on visibility/pageshow, periodically, and at start/end boundaries using database time anchored to a monotonic browser clock. Failed checks remove content and provide an explicit retry.

Map and Feed use the shared discovery shell. Pins use the approved venue latitude/longitude; Feed does not mount the map. The fresh directions action constructs a fixed Google Maps host and coordinates from a current public read. Public output omits private owner, permission, authority and review records.

The implemented media contract remains `none`: reviewers explicitly check that this submitted revision has no uploaded media. Synthetic fixture notes establish no real venue authority, media rights or business provenance.

## Repairs demonstrated during this phase

- Genuine approval initially violated the entry-event actor constraint, which had only admitted poster actions and reviewer rejection. The additive publication migration now permits reviewer approval and unpublish audit events while retaining direct-write revokes.
- Public data used environment-property names that did not match `getSupabaseEnv`; it now uses the actual Supabase URL and anonymous-key fields.
- Unpublish now checks the requested category against the locked entry before applying a versioned removal.
- Public detail includes the database clock even when unavailable. This supports exact expiry without trusting device wall time.
- Private form values and native datetime controls retain seconds, and a withdrawn entry can be freshly submitted for renewal.

## Verification and preservation

Final counts, browser groups, source hashes, cleanup and shared preservation: pending final record.

The opt-in clone runner is `scripts/db/entry-publication.local.mjs`; its task is `scripts/db/entry-publication-check.local.mjs`. It clones shared local data logically into labelled containers on an internal network with no published container ports, applies only the three entry migrations, disables schedules and clears delivery integrations. PostgreSQL is pinned to the patched `.113` image/digest. Permission-denial probes never target shared `.111`.

The native browser driver is written in the operating-system Temp directory and executed through the installed Playwright skill's universal runner. The completed JSON evidence archives its source and SHA-256; when the Temp file is absent, the checker recreates it from that record. Genuine Auth sign-in/TOTP challenge verification produces real sessions and SSR cookies. Browser verification consumes those cookies; it does not fabricate JWT assurance claims. Enrollment/challenge issuance is exercised through real Auth APIs rather than through native MFA setup forms.

Reproduce from this checkout in PowerShell, with local demo credentials and Docker available:

```powershell
$env:PINPOINT_ENTRY_PUBLICATION_LOCAL='1'
node scripts/db/entry-publication.local.mjs
npx.cmd vitest run --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
```

The scoped official advisor SQL is also required at `$env:TEMP/pinpoint-entry-advisors-2.109.0.sql`, with SHA-256 `4566342793150742ca7bf539295d4175af4218761925927190fdec31315ae15c`. The runner refuses a different query. Advisor results concern the new entry objects; they do not certify unrelated schema objects.

Earlier failed attempts are retained: [approval actor constraint](pinpoint-entry-publication-actor-constraint-failure-evidence.json), [policy fixture cleanup](pinpoint-entry-publication-policy-cleanup-failure-evidence.json), [second-session MFA harness](pinpoint-entry-publication-session-mfa-failure-evidence.json), and [advisor parser](pinpoint-entry-publication-advisor-parser-failure-evidence.json). The policy-cleanup attempt did not restore its clone counts because the synthetic published version was immutable; its entire labelled clone was still removed, and shared data/configuration remained unchanged. Later cleanup temporarily disables only named immutable triggers inside clone-only transactions with captured fixture IDs, then restores them.

## Evidence boundaries and next work

This is disposable patched-clone and development-browser evidence. The three entry migrations remain absent from shared local. Staging/production journeys, target parity and an integrated production build remain Phase 5 work. Real MapTiler tiles/geocoding are not verified: the browser substitutes a blank basemap and suggestions backed by a genuinely stored clone place UUID; final Google Maps navigation is intercepted. No external delivery, real supply or pilot is claimed.

Phase 3 is the next bounded task: the all-tab discovery/category/location/viewport matrix. The frozen Phase 1 ledger and preservation manifests remain historical checkpoints. The old 2/48 acceptance total is not recalculated from this local phase.
