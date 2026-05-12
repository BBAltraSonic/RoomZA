# RoomZA Public MVP Launch Plan

## Summary

Launch RoomZA as a public MVP in 4-6 weeks, excluding payments and lease signing. First launch covers public map discovery, auth/onboarding, landlord listing management, renter applications with documents, applicant review, gated chat, viewing scheduling, notifications, privacy/security hardening, production deployment, and launch operations.

Current verified state:

- `npm run lint` passes.
- `npm run build` passes.
- Core MVP routes compile.
- Live Supabase is missing `viewing_slots`, `viewing_slot_offers`, `viewings`, and `analytics_events`.
- Supabase logs show `profiles.full_name` query errors.

The missing Supabase schema and profile name mismatch are launch blockers.

## Launch Workstreams

### 1. Release Blockers

#### Reconcile Supabase Schema With Local Migrations

- Apply or repair the missing viewing and analytics migration in the live Supabase project.
- Confirm the following database objects exist:
  - `viewing_slots`
  - `viewing_slot_offers`
  - `viewings`
  - `analytics_events`
  - `viewing_status` enum
  - `book_viewing_slot_atomic` RPC
  - Required indexes for listing, application, slot, and user lookups
  - Required RLS policies for renter, landlord, and anonymous access boundaries
- Confirm the live schema matches `supabase/migrations/20260505100000_add_viewing_and_analytics_tables.sql`.
- Regenerate `src/lib/supabase/types.ts` after schema reconciliation.
- Re-run Supabase table inspection to confirm the generated types and live schema agree.

#### Fix Profile Name Schema/Code Mismatch

- Resolve the `profiles.full_name` query errors shown in Supabase logs.
- Choose one consistent model:
  - Add `full_name` to `profiles`, backfill where possible, and keep chat profile joins unchanged.
  - Or remove `profiles.full_name` selections from chat and use `profiles.email` plus application `full_name` where applicant identity is needed.
- Update chat headers and applicant displays to avoid runtime failures.
- Verify `getConversation` no longer fails due to missing profile columns.

#### Re-run Previously Failed Browser Flows

- Verify `/dashboard/listings/[id]/applicants` renders for the owning landlord.
- Verify `/messages/[id]` renders for the authorized renter and landlord.
- Verify both routes return 404 or redirect for unauthorized users.
- Confirm browser/dev logs no longer show dynamic route, missing column, or invalid UUID errors.

#### Fix Runtime And Accessibility Warnings

- Remove nested button rendering in `ApplicationModal`.
- Fix Base UI link-button accessibility warnings by using correct link semantics for navigation actions.
- Review the Google Places legacy Autocomplete warning.
- Treat the Google Places warning as non-blocking for launch unless the API fails for new production keys.
- Track migration to `PlaceAutocompleteElement` as post-launch technical debt.

### 2. Product Completion

#### Public Discovery And Listing Detail

- Verify the home page loads with the production Google Maps key.
- Verify map failure states when the Google Maps key is missing or rejected.
- Verify published listings render as map pins.
- Verify selected listings render in the desktop side panel.
- Verify selected listings render in the mobile bottom sheet.
- Verify listing cards render price, address, beds, baths, parking, and core amenities.
- Verify listing deep links preserve discovery context.
- Verify empty viewport, no-results, loading, and API-error states.
- Add or confirm launch-ready SEO metadata for:
  - Home page
  - Listing detail page
  - Auth page
  - Protected route fallback states
- Confirm protected pages are not accidentally indexed.

#### Auth And Onboarding

- Verify signup works in production-like settings.
- Verify login works for existing users.
- Verify logout clears the session.
- Verify `/auth/callback` handles Supabase redirect flows.
- Verify anonymous users are redirected from protected renter and landlord pages.
- Verify new users without a role are redirected to `/onboarding`.
- Verify renter onboarding redirects to `/applications`.
- Verify landlord onboarding redirects to `/dashboard`.
- Configure Supabase Auth redirect URLs for:
  - Local development
  - Preview deployments
  - Production domain
- Confirm email confirmation behavior is intentional for public launch.
- Configure custom SMTP before public launch.

#### Landlord Flow

- Create a listing draft from an empty landlord account.
- Edit listing details.
- Set address, latitude, and longitude through Google location picker.
- Upload listing images.
- Delete listing images.
- Enforce minimum 3 images before publishing.
- Publish a listing.
- Confirm published listing appears in public discovery.
- Archive or unpublish a listing if supported.
- View applicant count from the dashboard.
- Open applicant queue for a listing.
- Shortlist an applicant.
- Reject an applicant.
- Approve an applicant.
- Start or open an application conversation.
- Propose one or more viewing slots to a shortlisted applicant.
- Confirm landlord cannot access other landlords' listings, applicants, documents, chats, or viewings.

#### Renter Flow

- Browse public discovery while anonymous.
- Open listing detail.
- Attempt to apply while anonymous and confirm auth prompt.
- Sign up or log in as renter.
- Apply to a listing as a renter.
- Upload ID document.
- Upload payslip document.
- Reject missing, invalid, or oversized document uploads with clear messages.
- Confirm a submitted application appears on `/applications`.
- Confirm the application appears in the landlord applicant queue.
- Prevent duplicate active applications for the same listing.
- Enforce the 5 active application cap.
- Withdraw an active application.
- Confirm withdrawal frees one application slot.
- Show proposed viewing slots on the renter application page.
- Book one proposed viewing slot.
- Confirm the same slot cannot be double-booked.
- Confirm renter cannot access another renter's applications, documents, chats, or viewings.

#### Chat And Notifications

- Confirm inquiry/application conversations are gated.
- Confirm anonymous messaging is impossible.
- Confirm renter and landlord can send messages in an authorized conversation.
- Confirm messages persist in Supabase.
- Confirm realtime updates do not duplicate optimistic messages.
- Create notification events for:
  - New application
  - New message
  - Viewing proposed
  - Viewing booked
- Configure notification digest route with:
  - `CRON_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
- Verify digest route rejects missing or invalid authorization.
- Verify digest route marks processed notifications with `digest_at`.

### 3. Supabase And Security

#### Environment And Secrets

- Update `.env.example` with every launch-required variable:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `CRON_SECRET`
  - `NEXT_PUBLIC_APP_URL` or equivalent canonical app URL
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is only used in server-only code.
- Ensure no secret appears in a `NEXT_PUBLIC_*` variable.
- Ensure production keys are configured in Vercel and not committed.
- Restrict Google Maps API key by production domain.
- Restrict Resend sender to verified production domain.

#### Row Level Security

- Verify RLS is enabled on every public table.
- Verify anonymous users can read only public published listing data.
- Verify authenticated renters can:
  - Read and update only their own profile.
  - Read their own applications.
  - Insert their own applications.
  - Withdraw their own applications.
  - Read their own application documents.
  - Access their own conversations and messages.
  - Read and book viewing slots offered to their own applications.
  - Read their own notifications.
- Verify landlords can:
  - Read and manage only their own listings.
  - Read applications only for their own listings.
  - Read documents only for applications to their own listings.
  - Access conversations only for their own listings/applications.
  - Create viewing slots only for their own listings.
  - Read booked viewings only for their own listings.
  - Read their own notifications.
- Verify other landlords cannot see competitor listing applications or private documents.
- Verify other renters cannot see another renter's application data.
- Verify public listing image access does not expose private document storage.

#### Storage

- Confirm `listing-images` bucket is public.
- Confirm `application-documents` bucket is private.
- Confirm landlords can upload listing images only into their own folder structure.
- Confirm landlords can update/delete only their own listing images.
- Confirm renters can upload application documents only into their own folder structure.
- Confirm renters can read only their own uploaded documents.
- Confirm owning landlords can read documents only for applications tied to their listings.
- Confirm non-owning landlords and anonymous users cannot read private documents.

#### Supabase Production Hardening

- Run Supabase Security Advisor and resolve critical/high issues.
- Run Supabase Performance Advisor and resolve launch-relevant issues.
- Enable SSL enforcement.
- Configure custom SMTP for Supabase Auth.
- Review auth email rate limits for launch traffic.
- Review OTP expiry and OTP length.
- Enable CAPTCHA or bot protection if signup abuse risk is high.
- Confirm backup plan and project tier are acceptable for public launch.
- Subscribe to Supabase status updates.
- Document manual recovery steps for:
  - Bad migration
  - Broken auth redirects
  - Failed email delivery
  - Storage access issue
  - Accidental public data exposure

### 4. Testing And Quality Gates

#### Automated Checks

- `npm run lint` must pass.
- `npm run build` must pass.
- Add focused unit tests for:
  - Listing required field validation
  - Minimum 3 listing images before publish
  - Amenities metadata parsing
  - Application cap active status rules
  - Duplicate application prevention
  - Notification payload creation
  - Viewing slot booking validation
- Add integration tests for:
  - Renter application submission
  - Landlord applicant status updates
  - Chat message insertion
  - Notification digest processing

#### Database And Security Tests

- Add RLS tests for:
  - `profiles`
  - `listings`
  - `listing_images`
  - `applications`
  - `documents`
  - `conversations`
  - `messages`
  - `viewing_slots`
  - `viewing_slot_offers`
  - `viewings`
  - `notification_events`
- Add negative access tests:
  - Anonymous user cannot read private application data.
  - Renter cannot read another renter's application.
  - Renter cannot read another renter's documents.
  - Landlord cannot read another landlord's applicants.
  - Landlord cannot read another landlord's application documents.
  - User cannot send messages to a conversation they are not part of.
- Add concurrency test proving only one booking succeeds for a viewing slot.
- Add document storage tests for renter, owning landlord, other landlord, and anonymous user.

#### Browser Regression Matrix

- Anonymous user:
  - Opens discovery.
  - Opens listing detail.
  - Attempts protected routes and gets redirected.
  - Opens auth page.
- New renter:
  - Signs up.
  - Completes onboarding.
  - Sees empty application dashboard.
  - Applies to a listing.
  - Tracks application status.
- New landlord:
  - Signs up.
  - Completes onboarding.
  - Sees empty dashboard.
  - Creates a listing.
  - Uploads images.
  - Publishes listing.
- Existing landlord:
  - Opens dashboard.
  - Edits listing.
  - Opens applicant queue.
  - Shortlists applicant.
  - Approves/rejects applicant.
  - Opens chat.
  - Proposes viewing slots.
- Existing renter:
  - Opens application dashboard.
  - Opens chat.
  - Books proposed viewing.
  - Withdraws an active application.
- Responsive devices:
  - Desktop discovery map and side panel.
  - Mobile discovery map and bottom sheet.
  - Mobile auth/onboarding.
  - Mobile listing form.
  - Mobile application form.
  - Mobile applicant cards.
  - Mobile chat.
  - Mobile viewing picker.

#### Launch Acceptance Criteria

- No blocking console or runtime errors in critical flows.
- No failed protected-route access control checks.
- No cross-user data leaks.
- No missing table or missing column errors in Supabase logs.
- All launch-critical browser flows pass.
- Updated browser QA report is saved with evidence.
- Known non-blocking risks are documented with owners and target dates.

### 5. Deployment And Launch Ops

#### Production Deployment

- Create or confirm Vercel production project.
- Configure production environment variables.
- Configure production domain.
- Configure Supabase Auth redirect URLs for production domain.
- Configure Google Maps key restrictions for production domain.
- Configure Resend sender domain and DNS records.
- Configure cron schedule for notification digest route.
- Confirm production build deploys successfully.
- Confirm production app can connect to production Supabase.
- Confirm production app can send email.

#### SEO And Public Web

- Add or confirm metadata for public pages.
- Add sitemap if listings should be indexed.
- Add robots rules:
  - Allow public discovery and listing pages if indexing is desired.
  - Disallow protected dashboards, applications, messages, and auth callback routes.
- Confirm listing pages have stable canonical URLs.
- Confirm unavailable listings return appropriate metadata or 404 behavior.

#### Monitoring And Support

- Add basic error monitoring or define a manual log review process.
- Create a launch dashboard tracking:
  - Signups
  - Role onboarding completion
  - Published listings
  - Listing views
  - Applications submitted
  - Applicant shortlist rate
  - Viewing proposal rate
  - Viewing booking rate
  - Failed notification count
- Create support inbox and escalation process.
- Create moderation process using Supabase dashboard until a dedicated admin UI exists.
- Define response playbooks for:
  - Scam listing report
  - Abusive message report
  - User cannot access account
  - Landlord cannot view applicant documents
  - Renter cannot upload documents
  - Viewing slot booking failure

#### Content And Legal

- Add Terms of Service page.
- Add Privacy Policy page.
- Add POPIA/data handling page or section.
- Add document upload privacy disclaimer.
- Add safety copy for renters and landlords.
- Add clear MVP payment disclaimer:
  - RoomZA does not collect deposits or rent at launch.
  - Lease signing and payments happen offline between renter and landlord.
  - Users should avoid sending money before verifying the property and landlord.
- Prepare launch seed inventory.
- Prepare QA accounts for support and demo use.

#### Rollout Plan

- Week 1: Fix release blockers.
  - Reconcile Supabase schema.
  - Fix profile name mismatch.
  - Fix runtime warnings.
  - Re-run failed applicant and message flows.
- Week 2: Complete core product QA.
  - Verify landlord listing lifecycle.
  - Verify renter application lifecycle.
  - Verify chat.
  - Verify viewing scheduling.
  - Verify notification events.
- Week 3: Harden security and tests.
  - Add RLS/security tests.
  - Run Supabase advisors.
  - Fix critical/high findings.
  - Complete responsive browser regression.
- Week 4: Production readiness.
  - Configure production deployment.
  - Configure domains, email, cron, and secrets.
  - Add legal/safety copy.
  - Add launch dashboard.
  - Seed launch inventory.
- Weeks 5-6: Buffer and public rollout.
  - Run controlled production beta.
  - Fix bugs found by real users.
  - Re-run final QA.
  - Launch publicly.

## Public Interfaces / Types

- Supabase schema must match generated TypeScript types before launch.
- Viewing and analytics tables must exist in the live project before shipping the viewing flow.
- Profile identity fields must be consistent across database schema, generated types, chat queries, and applicant displays.
- `.env.example` is the canonical launch environment contract.
- Production routes remain:
  - `/`
  - `/listing/[id]`
  - `/auth`
  - `/onboarding`
  - `/applications`
  - `/dashboard`
  - `/dashboard/listings/new`
  - `/dashboard/listings/[id]/edit`
  - `/dashboard/listings/[id]/applicants`
  - `/messages/[id]`
- First launch does not expose public payment, lease signing, KYC, agency, maintenance, inspection, or admin dashboard interfaces.

## Post-Launch Roadmap

The following features are intentionally excluded from first public MVP launch:

- Payments.
- Lease signing.
- KYC identity verification.
- Credit checks.
- Open banking income verification.
- Admin dashboards.
- Agency team management.
- Bulk listing imports.
- Maintenance ticketing.
- Move-in and move-out inspections.
- Tenant billing history.
- Escrow or payout flows.
- AI renter scoring.
- AI listing copy generation.

Recommended order after MVP launch:

1. Admin and moderation dashboard.
2. Saved searches and renter alerts.
3. Stronger analytics dashboard.
4. Lease/document center.
5. Payments and deposit handling.
6. KYC and financial passport.
7. Maintenance and occupancy lifecycle.
8. Agency/team workflows.

## Assumptions

- First launch is a public MVP, not the full transactional RoomZA platform.
- Timeline is 4-6 weeks.
- Payments and lease signing are excluded from launch-blocking scope.
- South Africa remains the primary market.
- Currency defaults to ZAR.
- Timezone defaults to Africa/Johannesburg.
- Manual support and moderation through Supabase dashboard is acceptable until admin tooling is built.
- Public launch can proceed with offline payment and lease processes if safety copy is clear.
- Browser QA evidence should be updated before declaring launch readiness.
