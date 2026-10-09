# Phase 5 migration and recovery review

6 October 2026 SAST. Owner: Codex for local preparation; BB approves any later target changes. This is a reviewed local sequence, not shared migration or deployment authorization.

## Baseline and ordered manifest

[Baseline](pinpoint-phase5-baseline-2026-10-06.json): HEAD `4942af29f702900146397027125e9c91617ed318`, 87 source migrations, 71 applied shared-local versions, 16 pending and no runtime-only versions. [Manifest](pinpoint-phase5-manifest-2026-10-06.json) contains all source SHA-256 values, applied-history comparison flags, ordered pending files, referenced objects, privilege statements, current source hashes and image versions. Seventy stored statement serializations differ from source; this is not proof of seventy semantic defects. Do not replay applied migrations or rewrite history to hide text differences.

The exact sequence below was applied successfully to the isolated restored clone. Services (`20261003081807`), Places, notification writer security and Offer intake already exist in shared local and were preserved. A different target must be reconciled independently before this sequence can be reused.

| Order | Version | Change / prerequisite |
| --- | --- | --- |
| 1 | 20261001220000 | Offer review queue; existing Offer intake, admin roles and MFA |
| 2 | 20261002010000 | Revision-bound poster permission |
| 3 | 20261002023000 | Reviewer evidence and permission review |
| 4 | 20261002040000 | Place/location/date review |
| 5 | 20261002060000 | Atomic decisions and immutable publication evidence |
| 6 | 20261002070000 | Public eligibility projections |
| 7 | 20261002070109 | Confirmed reviewer queue |
| 8 | 20261002080000 | Private owner status |
| 9 | 20261002083512 | Moderation target integration |
| 10 | 20261002120900 | Recipient notification read state |
| 11 | 20261002162631 | Service-only versioned Property content save |
| 12 | 20261003025344 | Separate Tourism/Event intake |
| 13 | 20261003032659 | Corrections and immutable submitted revisions |
| 14 | 20261003100134 | Revision permission/review/publication and time-bound public reads |
| 15 | 20261006180626 | Trusted-session lifecycle writes; existing Property/organization schema |
| 16 | 20261006181312 | Active-session helper, seller-interest/progress primitives |

Apply each reconciled migration transactionally and record its verified source hash. The lifecycle function at order 15 references the helper defined at order 16; PostgreSQL accepted this sequence in the rehearsal, but callers must stay quiescent until both are installed. Cut over the final application only after the entire required sequence and privilege checks succeed. Current source calling absent primitives is not backward-compatible with the shared 71-version schema.

## Code Review

**Verdict:** APPROVE for the scoped local migration sequence. **Confidence:** MEDIUM. Target operation remains gated by actual parity and recovery checks.

The two Phase 4 additions preserve ordinary write revokes. Lifecycle/purchase mutations use security invoker, empty search paths and service-role-only EXECUTE. Server adapters validate identity/session claims and derive the actor rather than accepting it from input. The narrow active-session definer locks Auth rows and checks confirmation, anonymity, bans and suspension; ordinary roles cannot call it. Listing row locks, exact timestamps, current organization owner/admin membership, readiness and active-application checks protect lifecycle transitions. Buyer-interest locks and purchase-progress row locks merge persisted stages atomically. The clone covers stale/foreign/revoked/logout denials and simultaneous progress changes.

No P0/P1 defect was demonstrated in this scoped review. Relevant remaining limitations: native cookie/organization flows are unverified; deletion retains image bytes because duplicates share object paths; no orphan garbage collector exists. Function removal is not a data-preserving reversal of successful user mutations. No destructive down migration is proposed.

## Rehearsed recovery

[Recovery summary](pinpoint-phase5-recovery-2026-10-06.json) links the complete labelled clone evidence. The harness restored a read-only logical dump of shared data into pinned patched PostgreSQL `.113`, preserving the original catalogue and table security. It disabled cron execution and all active cloned schedules, removed Auth hooks, made SMTP unreachable and used an internal network, separate Storage volume and loopback delivery sink.

All 16 pending migrations then applied. Six lifecycle groups and three real Auth/REST/private-Storage/HTTP-sink runtime tests passed. Captured synthetic account/listing/organization IDs were cleaned and the migration baseline restored. App Auth/Next adapters are injected; these tests do not certify browser cookies.

After stopping cloned Auth/REST/Storage, a second custom-format dump of the fully migrated database was restored into that owned clone. All **134 public/Auth/Storage table counts and sorted row fingerprints**, function definitions/ACLs, table grants/RLS, policies and all **87 migration versions** matched. Cron remained off and no active job remained. Dumps existed only in memory; their byte counts and SHA-256 values are recorded. These transient rehearsal dumps are not retained recovery backups.

[Storage byte recovery](pinpoint-phase5-storage-recovery-2026-10-06.json) separately archived a synthetic private PDF path, deleted its original bytes and restored the archive into a different empty labelled volume. SHA-256 matched. The helper had no network; owned resources were removed. Shared Storage has zero objects. This proves the local file-backend recovery primitive, not a hosted S3 inventory, combined restored signed-file API journey or target PITR recovery.

Supabase database backups contain Storage metadata, not file bytes. A release recovery set therefore requires separate database and object backups, with a consistent cutoff and ownership/policy/config manifests. [Official backup documentation](https://supabase.com/docs/guides/platform/backups).

## Later target procedure and recovery boundaries

1. Identify the exact staging/target and owner. Record schema, migration history, function signatures/ACLs, RLS/policies, Storage buckets/paths, Auth MFA/session configuration, cron/hooks, app public values, Worker bindings and source/lockfile hashes. Reconcile actual semantic differences; do not infer parity from version names.
2. Agree a write pause, recovery cutoff, RPO/RTO, retention and support owner. Capture a verified database backup plus role/membership definitions, separately held role credentials, Storage bytes with object checksums, and configuration/secret references. Keep secrets out of this release package.
3. Restore that exact recovery set in a separate environment, with schedules/hooks/external delivery disabled. Prove representative private object access and denials through the restored API, restore object counts/checksums and security, and measure recovery time. Local synthetic success does not close this target gate.
4. During an approved release window, retain the old source/artifact and suspend writes while applying the verified pending sequence. On any failure stop before source cutover, preserve diagnostics and establish the actual applied state. Never run all pending migrations blindly.
5. Prefer roll-forward for additive functions after a bounded correction. Reverting only application code is allowed only after checking its table/RPC/ACL compatibility; do not restore old direct-write permissions. If database restoration is necessary, reconcile all writes after the backup cutoff before accepting data loss. Object restore must use the same cutoff; retained duplicate image references must remain valid.
6. Re-enable only approved schedules and delivery integrations after privacy/session/MFA/public-eligibility checks. Record checks and explicit release approval before deployment; pilot approval and real supply remain separate.

Shared Postgres remains `.111`. Never reproduce its known revoked-EXECUTE crash or relax permissions to work around it. Patched-clone success is not an approved shared upgrade or target remediation. Hosted backup availability, role credentials, actual Storage backups, staging parity, RPO/RTO and operational owners remain unresolved pre-launch inputs.
