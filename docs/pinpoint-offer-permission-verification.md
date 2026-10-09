# Revision-specific poster permission — 2 October 2026

The image-free poster flow now requires explicit shop authorization for each submitted revision. The permission record and immutable submitted content are committed in one transaction. The original offer schema, lifecycle, intake adapter, migration, function bodies and permission revokes remain intact. This slice grants no approval or public visibility.

Build selected a separate evidence rule following the user's clarification: no mandatory image; decide permission separately. The poster's statement is necessary but insufficient for publication. An admin must later check supplied written authorization or an existing permissioned business record. Shop-owned public information can corroborate content/address/dates, but does not establish this poster's authority. [Working publication contract](pinpoint-offer-publication-contract.md).

## Implementation

Migration `20261002010000_pinpoint_offer_permission.sql` adds a private immutable revision/offer/poster-bound record, statement version/text and database confirmation time. RLS permits only the currently eligible owning poster to read it; anonymous and direct client writes are revoked. The empty-search-path private submission wrapper derives the actor from Auth, locks the offer, rechecks poster eligibility, then calls the preserved intake function and inserts permission in the same transaction. Retries can reuse an already permissioned pending revision; an earlier unpermissioned submission cannot acquire retroactive consent. The original intake remains available for preserved internal behavior, but such a revision is not permissioned for future approval.

The cookie adapter and private API use the new wrapper only for submission. Create/save/withdraw keep the original adapter. The form starts unchecked, clears consent after a successful save, requires fresh confirmation for submission, and retains its stable revision ID through an uncertain response. Consent is not copied from enrollment, a previous revision or a reload.

## Observed checks

The successful run passed **11 real Auth/HTTP/browser/SQL checks** on a disposable patched clone:

- Missing/false/outdated consent, cross-owner attempts and stale versions leave revision/event/permission counts unchanged.
- Anonymous/service-role RPC denial retains revokes; concurrent submissions serialize with one winner, and its retry creates no duplicate.
- Evidence is readable by the eligible owner; unrelated/anonymous access and direct client writes are denied. Revocation removes reads and submission access.
- Preserved original intake creates an unpermissioned revision, which cannot be retroactively permissioned.
- Actual poster-cookie HTTP rejects missing consent; desktop save clears confirmation and form submission persists exact revision evidence.
- Phone withdrawal and fresh resubmission produce a new permission record, retain the old immutable snapshot, reload unchecked, and have no horizontal overflow.

Desktop 1440 × 900 and phone 390 × 844 used the Los Angeles browser timezone; offer times stayed in South Africa time. Both [desktop](pinpoint-offer-permission-desktop.png) and [phone](pinpoint-offer-permission-phone.png) screenshots were visually inspected. No unexpected browser page/console errors or outside destinations were recorded. The synthetic shop/place/statement is test evidence only; it establishes no actual shop permission or place provenance.

The first attempt hit the driver's default 30-second response timeout and a transient Auth deletion error. It is not a pass. Its complete clone was removed with shared preservation checks; fixture counts had not fully returned before removal. The corrected run uses a longer response wait and guarded cleanup retries; all captured accounts/content were individually removed, and no fallback was needed. Next development logs contained cancelled-stream/aborted messages around navigation and shutdown; browser/SQL assertions passed. [First-attempt record](pinpoint-offer-permission-first-attempt-evidence.json).

## Containment, cleanup and boundaries

The additive migrations were applied **only to disposable patched clones**. Shared `.111`, disabled TOTP, data, permissions and configuration were unchanged. The labelled internal-only network had no published container ports; a loopback gateway forwarded Auth/REST only. Cron execution and copied schedules were disabled. Fixture email subscriptions were disabled; external delivery, map and telemetry keys were empty. App/browser requests were contained. Production secrets were not used.

Two captured disposable users, three offers, revisions/events/permissions and one tagged place were removed with identity and ownership guards; immutable triggers were restored. The clone returned to the migration baseline. Shared public/Auth-user/storage counts, Property fingerprints, schedules, original function definitions/ACLs, table security, container identities and configuration matched before/after. No crash/recovery markers were found. App, browser, gateway, labelled containers/volume/network were stopped or removed. [Full evidence and source hashes](pinpoint-offer-permission-local-evidence.json).

Quality after the app change: **1,078 tests passed; two opt-in cases skipped** across 203 files; full typecheck and targeted lint passed. The fresh [isolated CLI check](pinpoint-release-cli-verification.md) also passes for the permission changes: clean install, production build, both JavaScript budgets and zero production audit vulnerabilities. The earlier screen-only evidence is preserved separately. No shared browser, staging or production permission pass is claimed. The shared poster UI requires the new migration before this submission path is usable there. Approval/publication, admin permission evidence, place/shop/address review, directions/expiry and required environment acceptance remain open. Release 1 remains **2/48**.
