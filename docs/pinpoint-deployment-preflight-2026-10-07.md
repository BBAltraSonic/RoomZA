# Pinpoint hosted deployment preflight — 7 October 2026 SAST

BB requested migrations and deployment to Supabase and Cloudflare after the Phase 6 documentation commit was pushed. This authorizes those release operations. The earlier restriction on runtime upgrades and the exhausted browser cap remain separate constraints. No release migration, runtime upgrade, Worker upload or cutover was performed during this preflight.

**Decision: blocked before production writes by the hosted Postgres runtime patch and downtime decision.** The database reports Supabase Postgres `17.6.1.111`, PostgreSQL 17.6 on aarch64, with `supautils.hint_roles = anon, authenticated, service_role`. Existing local evidence records the revoked-EXECUTE crash on this runtime family. The upstream [`17.6.1.113` release](https://github.com/supabase/postgres/releases/tag/17.6.1.113) fixes the supautils hint-printing crash; [issue 2112](https://github.com/supabase/postgres/issues/2112) describes the reserved-role permission-denial failure. No denial probe was run on production. Preserve ordinary-role revokes; changing ACLs is not the remedy.

The next operational decision is a hosted Supabase patch upgrade with an agreed downtime window, to `.113` or a verified newer supported version. The available supported target and upgrade eligibility must be confirmed before initiation. The connected MCP tools and installed CLI do not expose a direct supported upgrade command. [Supabase upgrade guidance](https://supabase.com/docs/guides/platform/upgrading) documents downtime and post-upgrade validation. The shared local stack remains unchanged.

## Confirmed targets and source

Supabase: `RoomZA`, project `qleeedwnnfvmfjjymoco`, `eu-west-1`, active and healthy. Cloudflare: account `78269b65c633a2cc3664af5bfd05774d`, Worker `roomza`, [public URL](https://roomza.pinpoint-roomza.workers.dev). The existing 100% Worker version is `91197722-5882-4952-bece-877f505444cf`, deployment `18c5d62a-3cc0-4671-8568-8f718f7961da`; its identity is retained as a rollback candidate. Compatibility with future ACL/schema changes must be checked before using it.

Git HEAD is `fb4932de6e6685b4c27ea45eb65075d3cee3c37b` on `codex/phase6-release-package-2026-10-07`. That pushed commit contains documentation. The release application changes are pre-existing uncommitted working-tree files, copied into an isolated retained snapshot. Git HEAD alone cannot reproduce this artifact. All 1,196 Phase 5 source hashes and the Phase 6 protected-file baseline match. The index remains empty. Historical evidence and the inert Phase 5 build snapshot were preserved.

## Exact migration sequence

Production has **68** applied migrations; source has **87**. The linked CLI dry-run passed and found **19** pending migrations. This differs from shared local's earlier 16-migration sequence. [Machine-readable preflight](pinpoint-deployment-preflight-2026-10-07.json) records each file's exact SHA-256 and ordered position.

| Order | Version | Source migration |
| --- | --- | --- |
| 1 | 20260930142632 | notification_server_writes_only |
| 2 | 20260930164313 | pinpoint_offer_intake |
| 3 | 20261001220000 | pinpoint_offer_review_queue |
| 4 | 20261002010000 | pinpoint_offer_permission |
| 5 | 20261002023000 | pinpoint_offer_permission_review |
| 6 | 20261002040000 | pinpoint_offer_location_review |
| 7 | 20261002060000 | pinpoint_offer_decisions |
| 8 | 20261002070000 | pinpoint_offer_public_reads |
| 9 | 20261002070109 | pinpoint_offer_confirmed_queue |
| 10 | 20261002080000 | pinpoint_offer_owned_status |
| 11 | 20261002083512 | pinpoint_offer_moderation_targets |
| 12 | 20261002120900 | notification_read_state |
| 13 | 20261002162631 | pinpoint_property_save |
| 14 | 20261003025344 | pinpoint_entry_intake |
| 15 | 20261003032659 | pinpoint_entry_corrections |
| 16 | 20261003081807 | pinpoint_local_services |
| 17 | 20261003100134 | pinpoint_entry_publication |
| 18 | 20261006180626 | pinpoint_property_lifecycle |
| 19 | 20261006181312 | pinpoint_phase4_platform |

Apply only the reconciled missing versions, transactionally, without seed/reset/history rewriting. Keep callers quiescent until orders 18 and 19 are both installed. Stop on failure, record the actual ledger, and verify signatures, service-only EXECUTE, RLS and ownership before the application cutover. Existing [migration/recovery review](pinpoint-phase5-migration-recovery-2026-10-06.md) remains historical clone evidence.

## Retained recovery material

Recovery files are under `artifacts/releases/2026-10-07/pinpoint-deploy-preflight/recovery/`, which Git ignores. Their content includes production records and is not committed or published.

| Export | Bytes | Result |
| --- | ---: | --- |
| roles.sql | 297 | Completed; managed role settings, no custom login credential recovery proof |
| schema.sql | 453,955 | Export completed; CLI exited 1 afterward due to PostHog telemetry shutdown timeout |
| data.sql | 150,361 | Completed; 113 COPY sections including public, Auth and Storage data |
| managed-schema-supplement.sql | 164,584 | Completed; Auth/Storage schema and security supplement |
| history-cron-data.sql | 434,606 | Completed; applied migration ledger; pg_dump excludes cron job data |

Cron job commands, schedules and active states are retained separately in `target-after-exports.json`. All three jobs remained active and unchanged; no hook or schedule was disabled on the live target. CLI operations used existing management authentication and a temporary CLI login role. Server application secrets were not supplied to the build or exposed in the report.

All five Storage objects were copied separately: two blog-media files and three listing-images files, totalling **2,084,178 bytes**. Each copy matches its recorded size and MD5; SHA-256 values are retained in `objects-manifest.json`. The before/after object inventory matches. Production currently has zero objects in private buckets. [Supabase backups](https://supabase.com/docs/guides/platform/backups) do not contain Storage file bytes or custom role passwords.

The provider backup list returned `backups: null`, `pitr_enabled: false`, `walg_enabled: true`. WAL-G availability does not establish an available recoverable backup. The exact new production exports have not been restored. No coordinated write pause, common cutoff, measured RPO/RTO, hosted role-credential recovery or combined restored API/file journey is established. These remain recovery gates; the retained files do not close them by themselves.

After export, production still has 68 migrations, 1 listing, 3 listing-image rows, 1 saved home, 4 profiles/Auth users, and 1 each of applications, viewings, conversations and messages. These are count/inventory checks, not a whole-database equality assertion.

## Fresh target-specific artifact

The isolated snapshot is `artifacts/releases/2026-10-07/pinpoint-deploy-preflight/build/`. It contains 1,026 copied source files. Public app URL, Supabase URL and anon binding match the live Worker. The MapTiler public input was recovered from the deployed page; the Turnstile site key was recovered from the deployed authentication JavaScript in the widget's exact context. The latter uses a public-only `.env.production.local` inside the isolated snapshot. `.env.local` and production server application secrets were not copied or used as build inputs.

Fresh lockfile `npm ci`, OpenNext build, TypeScript, both JavaScript budgets, Wrangler dry-run and production dependency audit passed. The first snapshot build failed because the existing root image-loader/proxy files were omitted; they were added to the snapshot and the complete build passed. No shipping application file was changed for that correction.

- 91 routes meet the 1,300 KB first-load ceiling.
- Root compressed initial JavaScript is 251.0 KB against 300 KB.
- Worker compressed size is 2,889.5 KiB against 3,072 KiB.
- Production dependency audit found zero vulnerabilities.

Logs, source/public-input hashes and artifact hashes are recorded in the JSON preflight. Existing Windows/OpenNext and middleware/Edge-runtime warnings remain. No browser verification occurred. When cutover is unblocked, use this reconciled artifact only after checking current target/source drift, preserving existing runtime secrets and undeclared plain bindings with the installed deploy options. Do not deploy the inert historical Phase 5 artifact.

## Continuation boundary

1. Resolve the hosted runtime patch and downtime decision, verify its exact supported target, and preserve the retained recovery set.
2. Complete or explicitly resolve the target recovery gates and recheck the source/ledger/Worker version immediately before release.
3. Apply the recorded 19 migrations, verify the resulting ledger and security catalogue, then deploy the target-specific artifact with existing secret bindings preserved.
4. Perform bounded read-only HTTP/asset/security smoke checks, inspect release logs and compare protected counts/inventories. No fixture writes, contacts, real delivery or browser attempt are implied.

The browser cap remains exhausted. Phase 3/4/5 browser evidence, native cookies/MFA, operational owners, permissioned supply and pilot thresholds remain open. Deployment authorization does not mark the programme complete or authorize a public pilot. The original [Phase 6 release package](pinpoint-phase6-release-package-2026-10-07.md) remains a historical approval package; this preflight records the newer deployment request and its actual stop point.
