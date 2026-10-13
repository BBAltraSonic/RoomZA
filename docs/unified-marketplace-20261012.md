# Shared marketplace account implementation, 12 October 2026

One account now supports browsing, saving, enquiries and listing creation across Property, Services, Shopping Specials, Places and Events. Signup and Profile no longer require choosing or switching roles. Every signed-in account uses Explore, Saved, My listings, Messages and Profile. Guests retain discovery and consented public contacts.

## Implemented behavior

- Create listing opens /post; My listings opens /post/listings and links to the existing category workspaces. Existing dashboard/editor URLs remain valid.
- Ordinary sign-in and OAuth callbacks retain safe requested destinations and default to Explore. Legacy onboarding redirects directly. Password recovery, MFA, policy acceptance and admin authorization remain separate.
- The additive migration fills missing ordinary Property personas and detail rows, preserving saved values and existing primary/active selections. New profiles initialize all four ordinary capabilities. Category enrollment occurs during first draft creation and never restores revoked access.
- Property creation now uses the existing trusted-server pattern instead of restoring revoked table writes. The server verifies user/session claims and supplies them to a service-role-only, session-checked draft RPC. Retry IDs remain stable across uncertain responses. Ownership and publication guards remain enforced.
- Direct legacy-role restrictions on consumer eligibility and organization creation/invitations have been removed. Organization membership, invitation identity, suspension, public-contact consent and review controls remain intact.
- Typecheck excludes saved release copies and test snapshots under artifacts/ and .cache/.

## Interfaces and migration

- public.ensure_marketplace_account() enables only the current authenticated account's ordinary capabilities. It accepts no supplied identity or admin/reviewer flags.
- public.pinpoint_property_create_draft(actor_id, actor_session_id, target, payload) is executable only by service_role, verifies the live actor session, forces private draft status, and returns the owned listing ID. Repeated creation with the same target does not overwrite a record.
- Migration: supabase/migrations/20261012011144_unified_marketplace_accounts.sql. Apply after its prerequisite migrations, including Property lifecycle and the existing no-email-verification change, before deploying this app code.

## Verification

- 690 focused tests in 94 files passed, including auth/callback/redirect safety, navigation, ownership and category review/publication behavior.
- Typecheck and scoped lint passed. Production Next build passed; both JavaScript budgets passed (93 routes; discovery initial bundle 264.3 KB compressed against 300 KB).
- 56 PostgreSQL/Auth/REST/browser checks passed on a disposable local clone. The run covered new signup, legacy renter/seller capability completion with preserved details/selections, guest return paths, all category creation, rental and sale Property form submissions, keyboard navigation at 1440/390/320px, cross-account denial, suspension, organization membership boundaries, revoked poster access, private/unapproved drafts and persisted-draft retry safety.
- The clone, its network and volume were removed. Original local data fingerprints, table permissions, function definitions and container configuration were verified unchanged.
- Evidence and screenshots: [verification files](./unified-marketplace-20261012/verification.json), [database/browser evidence](./unified-marketplace-20261012/database-browser-evidence.json).

To repeat the isolated rehearsal with local Supabase and Docker available:

~~~powershell
$env:PINPOINT_RELEASE_CLONE_LOCAL = '1'
node scripts/db/unified-marketplace-clone.local.mjs
~~~

## Delivery boundary

No production deployment or migration of the existing database was performed. The checkout already contained other work; these changes were preserved. The source-path/hash manifest identifies this implementation's files, but overlapping files may also contain earlier changes, so it is not a standalone release patch.

Property form geocoder/map responses were fixtures; production map providers and real Google consent were not tested. OAuth callback behavior was tested automatically. Hosted migration history, an isolated Cloudflare/OpenNext release artifact and production browser verification remain deployment work.
