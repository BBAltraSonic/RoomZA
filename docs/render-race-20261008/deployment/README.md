# Cloudflare rendering-repair deployment — 8 October 2026

The user-authorized repair is deployed to [Pinpoint](https://roomza.pinpoint-roomza.workers.dev). Worker roomza version b5a8da34-bfa3-4dc7-8dfe-ff64ed74b6f9 receives 100% traffic, deployment 7905b136-96d6-4862-ad5b-264c1f9649c7, activated 2026-10-08T09:16:40.696953Z (11:16 SAST).

## Verified

- Fresh production build from the final reviewed source hashes; 1,152 files in an isolated retained release copy, no shared environment files or server credentials. Public MapTiler and Turnstile inputs were recovered from the previous release and matched current production output before deployment.
- All 91 route JavaScript budgets passed at 1,300 KB; root initial JavaScript 252.7 KB gzip against 300 KB. Worker artifact 3006.6 KiB gzip against 3,072 KiB; Wrangler upload reports 3,017.01 KiB gzip. Budgets were unchanged.
- All 25 read-only HTTP checks passed: 11 public pages, five protected-page authentication redirects, seven public feed/count endpoints, malformed-query rejection and private-document denial. The public pages include the visible stable content container. Protected checks establish server redirect output only.
- All 39 served initial-script and MapLibre worker asset hashes matched this release. No inert fixture settings found in shipped public scripts or HTML.
- Rollout metadata confirms the new version at 100%. All existing binding names/types and public variable values match the previous version; secret values were neither read nor replaced. Source hashes, package-lock.json, .env.local and the empty Git index remain preserved. No database migrations, fixtures, shared-stack changes or production data writes were performed.

## Limits and retained diagnostics

No browser attempt was made during deployment. The previous live startup timeout, capped local browser failure and unreached route/viewport coverage remain documented in [the repair report](../README.md) and [route ledger](../route-ledger.md). The privacy layout fix is deployed but has not been rechecked in a browser. This deployment does not establish complete interaction coverage, resolution of the original live startup blocker or production LCP/INP/CLS targets. The smoke checks used unauthenticated Node fetch, three concurrent requests and 30-second deadlines; no Worker runtime tail or sustained monitoring was performed.

The first packaging attempt failed when a reused dependency junction caused native Windows sharp binaries to enter the bundle. A fresh lockfile installation in the release copy resolved it without source or dependency changes. Both logs are retained. Existing middleware/Edge warnings and duplicate-key bundler warnings remain in the successful build logs. The initial auth-only public-key check found Turnstile; the separate discovery-page check found MapTiler. That initial assertion failure was a check-scope issue, not a production asset failure.

## Rollback and evidence

Previous Worker version: 7a2da33e-d5d3-48de-9a5e-6d84739a9c97; previous deployment: 2064e3e8-1cf7-407d-8ac5-a21507428737. This release changes no database schema. The previous version remains a rollback candidate; no rollback was needed.

[Release manifest](release.json), [rollout](rollout.json), [HTTP and asset evidence](smoke.json), before/after version/deployment metadata and build/deploy logs are retained beside this report. The earlier repair manifest remains the historical pre-deployment checkpoint.
