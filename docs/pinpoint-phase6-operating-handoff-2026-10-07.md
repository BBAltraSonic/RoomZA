# Pinpoint Phase 6 operating handoff

7 October 2026 SAST. Prepared operating procedures for BB's decision; **no pilot is running or authorized**. Read with the [release package](pinpoint-phase6-release-package-2026-10-07.md) and [readiness register](pinpoint-phase6-pilot-readiness-2026-10-07.md). Procedures describe required operating behavior; current browser/target proof and actual staffing remain open.

## Responsibilities and authority

BB is the known product/release decision owner. Every other human operating assignment is **unassigned** until BB names a person, backup, availability window and escalation channel and that person accepts. Codex prepares technical evidence in this chat; no continuing on-call commitment is assumed.

| Role | Assignment | Responsibilities / required readiness |
| --- | --- | --- |
| Product/release authority | BB | Accept scope/thresholds; name target and owners; decide deployment and pilot separately; authorize recovery/data-loss decisions |
| Operations incident lead and deputy | Unassigned | Staff agreed windows, monitor failures, maintain backup/configuration references, coordinate incident and controlled recovery; demonstrate target access |
| Authorized reviewer and deputy | Unassigned | Actual admin membership and enrolled MFA; verify submitted revision, permission/place/media/venue/date evidence; approve/correct/reject/unpublish through existing authorized paths |
| Poster/content owner per item | Unassigned | Permission and accuracy; own account/category enrollment; maintain dates/terms/location; submit corrections/renewals; withdraw owned content |
| Support/privacy triage and deputy | Unassigned | Accessible approved support channel; restricted incident log; handle report routing/acknowledgment, access/privacy escalation and user follow-up within authorized contact scope |
| Technical release executor | Unassigned for target work | Approved target identity/access, exact artifact/schema checkpoint, data-preserving sequence and measured recovery evidence; Codex may assist only within later explicit scope |

Proposed delegation for BB to accept: an assigned incident lead may stop pilot acceptance/new approvals and request suspension immediately on a stop trigger; an authorized reviewer may unpublish affected Specials/Services through existing permissions; a Property owner/admin may use its existing scoped lifecycle controls. BB may stop the pilot and is the final recovery/reopen authority, or may explicitly delegate those powers in writing. A role name alone grants no system permissions. A global feature switch, reliable maintenance mode or emergency account-revocation path must be demonstrated in G12 before relying on it; none is assumed here.

## Approval, correction and stale-content workflow

1. Intake: record content ID/category, poster account, submitted revision/version, app-owned place, media references and validity window. Keep private evidence private. Enrollment, Property ownership and reviewer authority are separate; one cannot grant another.
2. Review: use the exact submitted revision and current MFA session. Check separate poster permission plus actual venue/business/media authorization, coordinates/address, terms and SAST dates normalized to UTC. An omitted Shopping image is permitted; a present image still needs permission. Record reviewer identity, evidence references, decision, reason and time. “Approved” means the documented review, not a guaranteed service/visit/redemption.
3. Decision: approve only complete evidence. Return a clear correction reason or reject inadequate authority/accuracy. On stale-version/409, reload the current version and preserve unsaved inputs; never bypass version checks or patch database rows directly. Real browser proof of these paths remains G03.
4. Publication: confirm current public eligibility and card/pin/detail/count consistency. Shopping/Tourism/Event material submission hides publication until approval, and rejection cannot revive an older version. Services retains its own approved snapshot on pending edits/rejection; withdraw/unpublish where that snapshot is now inaccurate. No Event pause/resume is introduced.
5. Time checks: upcoming approved Events remain discoverable until their exact end, with Upcoming before start. Tourism/Shopping follow their current windows. Check stale open pages/actions and automatic end removal; do not depend on cron to establish eligibility. Renewals require new review/permission evidence.
6. Report/staleness: triage by ID/category and source URL; check current eligibility and evidence privately. A wrong venue, expired terms, disputed authority or materially inaccurate snapshot should be withheld/unpublished by an authorized actor pending correction. Preserve the decision/audit trail. Never remove all media or restore stale snapshots as a shortcut; duplicate Property listings may share image paths.

Support should record `receivedAt`, ID/category, minimal description, severity, owner, next update, decision/evidence link and `resolvedAt`. Do not log enquiry text, document bytes, tokens, email addresses or precise private locations into public analytics. Counts of directions/actions indicate intent, not completed visits/bookings. C2/C3 instrumentation and routing remain unverified carryovers.

## Privacy/access incident and escalation

Use the restricted incident log and assigned escalation channel (both unassigned). Capture time, affected target/artifact, route/object/content IDs, observed access class and sanitized reproduction evidence. Preserve logs and ACL/session state references; do not reproduce shared `.111` revoked-EXECUTE crashes or circulate private files as evidence.

| Severity / trigger | First response | Escalation and reopening evidence |
| --- | --- | --- |
| Critical: cross-owner/private bytes, privileged action without valid authority/MFA, unauthorized publication, loss/corruption | Stop pilot progression and new affected approvals; authorized actor unpublishes affected content or invokes a demonstrated approved containment control; preserve evidence | Notify assigned incident lead/BB using the accepted channel. BB authorizes necessary credential/session/target changes. Reopen only after root-cause correction, current denials, affected-scope review and explicit BB decision |
| High: wrong venue/action, expired public content, repeat discovery/action failure | Withhold/unpublish affected snapshot where authorized; record scope/impact and route to reviewer/technical owner | Apply accepted stale/error thresholds. Suspend affected cohort if containment cannot be verified; obtain current public/status proof before reopening |
| Routine: incomplete submission, correction or support question | Keep incomplete content private, supply precise correction reason, record turnaround | Escalate when accepted service window is exceeded; do not expand publication to clear a queue |

Actual messages, poster contact or user notification require the relevant later operating/contact authorization. This preparation sends none. The support/privacy owner must determine any actual incident notification obligations through the appropriate review; no legal policy or invented deadline is created here.

## Stop, recovery and restart

Any operator should report a stop trigger immediately. BB can order a full stop. Before pilot authorization, BB must delegate executable containment powers, demonstrate controls and accept who can stop while BB is unavailable. If an unassigned or inaccessible owner would leave a privacy failure uncontained, G12 fails and the pilot must not start.

For recovery, follow the [Phase 5 procedure](pinpoint-phase5-migration-recovery-2026-10-06.md#later-target-procedure-and-recovery-boundaries): hold affected writes, establish the actual applied state and compatible source, retain diagnostics, prefer reviewed roll-forward, or restore the consistent database/object recovery set in isolation. BB authorizes target restoration and any accepted data loss after post-cutoff write reconciliation. Never restore direct-write grants or drop shared place/history data to make an old app run. Retained image bytes require reference-aware recovery.

Reopening requires correct schema/ACL/RLS, Auth/session/MFA, public/private eligibility, combined private-file API checks, object checksums and approved monitoring/schedule/delivery configuration. Record measured RPO/RTO, incident disposition, remaining limitations, executor and BB's decision. Successful database restoration alone does not reopen the pilot.

## Handoff acceptance — unresolved

- [ ] BB names every role/deputy and delegated stop/recovery powers; owners accept coverage windows and escalation route.
- [ ] Reviewer/poster accounts and actual MFA/category/organization access are verified on the named target; no account created here.
- [ ] Restricted support log/channel, report routing and privacy-safe metrics are demonstrated.
- [ ] Approved containment/fallback works for each category; no presumed global switch or Event pause feature.
- [ ] Backup retention, consistent-cutoff object recovery and measured combined private-file drill meet accepted objectives.
- [ ] Permissioned supply and threshold decisions are signed off; deployment and public pilot remain separate decisions.
