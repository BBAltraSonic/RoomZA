# RoomZA deployment result - 7 October 2026

The authorized Supabase upgrade, 19 pending migrations, and Cloudflare production cutover completed. This report supersedes the preflight's blocked deployment status.

## Deployed targets

- Live application: [RoomZA](https://roomza.pinpoint-roomza.workers.dev).
- Supabase project: RoomZA, qleeedwnnfvmfjjymoco, eu-west-1. Stable database image upgraded from 17.6.1.111 to 17.11.0.003; ACTIVE_HEALTHY verified after upgrade.
- Migration ledger increased from 68 to 87, latest 20261006181312. Exact versions and SHA-256 hashes are in the companion JSON. Fresh linked dry-run and db push completed without reset or seed.
- Cloudflare Worker: roomza; version 34d9dd1b-bd4b-45f1-965d-cffaa24afe8f; deployment 549f0954-3f89-42ec-a1f6-392b7d62f5ec; 100% traffic, deployed 2026-10-07T07:26:19.568965Z (09:26 SAST).
- Worker compressed size: 2899.45 KiB against 3072 KiB budget. Existing secret bindings were preserved; secret values are absent from this report and the isolated build inputs.

## Verification and preservation

All 14 read-only HTTP checks passed: public pages, rent/buy Property feeds, offers and count, Tourism, Events, Services, malformed-query rejection, protected-page authentication redirects, and private-document 401 denial. The first status-only assertions for protected pages expected 307; inspection confirmed Next.js streamed NEXT_REDIRECT and refresh metadata inside HTTP 200. This establishes server redirect output, without asserting browser completion. Both the first assumptions and corrected evidence are retained.

One served application chunk and both MapLibre 6.11.2 worker modules returned 200 and matched the prepared build SHA-256 hashes. Empty feed responses reflect current unpublished production supply; no fixtures were created or published.

Final SQL comparison matched the pre-upgrade snapshot: one listing, three listing images, one saved home, four profiles, four Auth users, one application, one viewing, one conversation, and one message. Property row fingerprints, five Storage object metadata records, and three active cron job definitions remained unchanged. The shared local stack, local environment files and pre-existing dirty work were preserved; the Git index remains empty.

The current production export set passed an isolated restore rehearsal after resolving restore ordering and managed publication scaffolding. The owned disposable container and volume were removed. Storage byte copies were separately verified; the rehearsal does not prove a combined hosted database and Storage recovery journey.

## Remaining verification and operational limits

- Browser login, cookie, MFA and full discovery journeys remain unverified; exhausted browser cap was respected.
- Public feed checks returned empty datasets; no published inventory or pilot supply was manufactured.
- Security advisors retain WARN/INFO findings including executable public SECURITY DEFINER query functions and disabled leaked-password protection. All public tables have RLS; five Property/session/buyer/purchase RPCs deny anon and authenticated EXECUTE and allow service_role. Existing listings table grants remain with RLS; local clone revoke claims do not describe production.
- Recovery rehearsal restored this export set into an isolated .113 clone; hosted 17.11 parity, role credentials, coherent write cutoff, RPO/RTO and combined API plus Storage recovery remain unverified. Five Storage byte copies were independently verified.
- Previous Worker version is retained as a rollback candidate; compatibility with the migrated schema and ACLs must be checked before rollback.
- No runtime tail was performed. HTTP observations are bounded checks, not sustained monitoring.

## Evidence

Companion result: pinpoint-deployment-result-2026-10-07.json. Detailed evidence is retained locally under artifacts/releases/2026-10-07/pinpoint-deploy-preflight/ (ignored, including recovery data): migration apply and dry-run logs, before/after SQL snapshots, migration ledger and RPC/RLS evidence, security advisors, restore results, Cloudflare metadata, HTTP checks and served HTML. Build preflight validation and budgets remain in pinpoint-deployment-preflight-2026-10-07.md/.json. The upgrade completion screenshot is pinpoint-supabase-upgrade-complete-2026-10-07.png.

Supabase upgrade references: [upgrade guide](https://supabase.com/docs/guides/platform/upgrading), [stable image release](https://github.com/supabase/postgres/releases/tag/17.11.0.003).
