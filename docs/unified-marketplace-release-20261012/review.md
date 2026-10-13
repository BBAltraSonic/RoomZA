# Unified marketplace review

Verdict: APPROVE. No blocking findings in the inspected account, creation, enrollment and routing changes.

The local migration is absent from the linked qleeedwnnfvmfjjymoco project. All earlier local migrations are installed. The linked dry-run listed only 20261012011144_unified_marketplace_accounts.sql; no include-all, seed, roles, replay or history repair is required.

Live schema checks confirmed the four marketplace enum values, profile foreign keys, profile/persona composite key, primary and active partial unique indexes, insert defaults and nullable detail fields. All relevant tables retain RLS. The existing Auth signup trigger creates the profile and does not subsequently insert conflicting personas. The new profile trigger can therefore initialize new permanent accounts without altering the Auth trigger.

Eleven permanent profiles exist, six without personas; two renter and three landlord persona rows exist. The backfill only inserts missing ordinary personas and empty missing detail rows. Existing profile role, active organization, persona flags, details, privileged memberships and category posting capabilities are not updated. Profiles without personas receive a primary and active renter selection. Anonymous users are excluded. Banned/suspended users do not gain operational access because the runtime session checks remain enforced.

The self-recovery function has no supplied actor argument, checks the current active Auth session and cannot grant admin/reviewer privileges or restore category posting revocations. Private setup helpers are revoked from all application roles. The trusted draft function uses SECURITY INVOKER and is executable only by service_role; the server action checks the user and matching JWT subject/session before supplying its arguments. Draft validation, ownership, organization exclusion, policy acceptance and idempotent target creation are retained.

Organization creation and invitation acceptance retain their current signatures, SECURITY DEFINER modes, ACLs, ownership/membership writes and invitation email/expiry/revocation checks. The obsolete landlord role gate becomes an active permanent-session/account/policy gate. The recovery function intentionally uses a narrow definer bridge to an existing session validator which application roles cannot directly call.

The reviewed local verification manifest still matches every recorded source hash, including the migration and disposable clone scripts. Its 56 PostgreSQL/Auth/REST/browser checks are historical local evidence, not current hosted authenticated-flow verification. Fresh isolated application tests, build and post-application live invariants are required for release.
