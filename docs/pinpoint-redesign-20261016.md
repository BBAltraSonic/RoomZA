# Pinpoint redesign continuation, 16 October 2026

## Scope and checkpoint

Resumed the interrupted first review set from chat 01a142a6-8b2f-7213-a797-d2a41df8c0ce (Plan Pinpoint design redesign). The user-approved plan requires review of representative screens before expanding the screen-by-screen redesign. This checkpoint does not authorize deployment or migrations. Existing user-flow audit changes and deferred private-document checks remain separate and preserved.

The working tree and prior redesign baseline are preserved under .cache/pinpoint-redesign-20261016; this continuation also saved a working-tree patch and status under continuation-baseline. No commit, deployment, database migration, or real-account mutation was performed.

## First review set

Shared charcoal/amber semantic tokens, the dark header, mobile Explore/Saved/Create/Messages/Profile tabs, dark discovery maps, rounded cards, floating desktop details, and the creation/manage category workspace were already implemented in the interrupted chat.

Continuation fixes: updated obsolete navigation/results-visibility test expectations, fixed a tuple type error, reserved space for map controls when expanding details, kept the map-loading treatment dark, restored Escape dismissal when focus returns to the map/results, removed the old Property-detail rule that hid the newly approved mobile tabs, moved the legacy detail price badge to amber, and made floating-panel map actions compact.

Review deliverables: C:/Users/BB/Documents/Codex/2026-10-16/new-chat/outputs/pinpoint-review/index.html and verification.md. The production-preview snapshot lives in that chat's work/pinpoint-build directory. Fixture browser scripts are in the Windows temporary directory, playwright-test-pinpoint-review.cjs. Protected-workspace component harness lives in work/redesign.

## Inventory and ownership

- 93 page routes inventoried from current tracked and untracked source.
- Discovery chrome: src/components/navigation/pinpoint-header.tsx, pinpoint-chrome.tsx and their CSS modules; global navigation owns workspace headers and mobile tabs.
- Discovery composition: Property discovery-page.tsx, DiscoveryShell for Services/Shopping/Places/Events, shared FloatingDiscoveryDetail and DiscoveryDetailSurface. Property retains listingId; the other categories retain detailId.
- Map styling: src/lib/maptiler.ts, map-view.tsx, discovery-map.tsx, mobile/listing-marker.tsx, shared map-controls.tsx. The style is dark in both themes. Markers/selected-radius overlays use amber roles; status semantics remain separate.
- Listing workspaces: ListingCategoryWorkspace and CategoryLinks; existing route owners retain authorization. ListingDraftForm retains its data and creation flow.
- Loading/error/empty states: discovery-loading.tsx, DiscoveryPageFallback, DiscoveryResultsSummary, PropertyEmptyState, existing route-state and app error boundaries. Previous results remain visible after failed refresh.
- Color inventory scanned 967 source files and flagged 18 files with literal colors or color utilities for contextual review. Provider/media/status colors require contextual classification. Remaining screen-by-screen changes are deferred at the user review gate.

## Review gate

Do not expand the redesign to remaining authentication, messaging/calls, applications/purchases/viewings, admin, profile/settings/notifications or public-information screens until the user reviews the representative set. Shared token propagation alone does not prove those screens were reviewed. Browser/installed-app static image branding and external email artwork remain outstanding for later approved scope.

## Evidence boundary

See the deliverable verification report for the latest build, tests, lint, browser measurements and outstanding checks. Browser discovery uses intercepted public API results and a blank dark map style. It does not establish live MapTiler rendering, hosted data, authenticated workflows, real-device keyboard/safe-area behavior, or production deployment. Create/My listings/draft screenshots render actual components in an isolated fixture harness without bypassing production authentication.

## Route inventory

- `/purchases` — `src/app/purchases/page.tsx`
- `/viewings` — `src/app/viewings/page.tsx`
- `/account-suspended` — `src/app/account-suspended/page.tsx`
- `/admin/applications` — `src/app/admin/applications/page.tsx`
- `/admin/audit` — `src/app/admin/audit/page.tsx`
- `/admin/blog/[id]/edit` — `src/app/admin/blog/[id]/edit/page.tsx`
- `/admin/blog` — `src/app/admin/blog/page.tsx`
- `/admin/entries` — `src/app/admin/entries/page.tsx`
- `/admin/inbox` — `src/app/admin/inbox/page.tsx`
- `/admin/listings/[id]` — `src/app/admin/listings/[id]/page.tsx`
- `/admin/listings` — `src/app/admin/listings/page.tsx`
- `/admin/offers/[id]` — `src/app/admin/offers/[id]/page.tsx`
- `/admin/offers/confirmed` — `src/app/admin/offers/confirmed/page.tsx`
- `/admin/offers` — `src/app/admin/offers/page.tsx`
- `/admin/operations` — `src/app/admin/operations/page.tsx`
- `/admin` — `src/app/admin/page.tsx`
- `/admin/privacy-requests/[id]` — `src/app/admin/privacy-requests/[id]/page.tsx`
- `/admin/privacy-requests` — `src/app/admin/privacy-requests/page.tsx`
- `/admin/reports/[id]` — `src/app/admin/reports/[id]/page.tsx`
- `/admin/reports` — `src/app/admin/reports/page.tsx`
- `/admin/security/mfa/challenge` — `src/app/admin/security/mfa/challenge/page.tsx`
- `/admin/security/mfa/setup` — `src/app/admin/security/mfa/setup/page.tsx`
- `/admin/security` — `src/app/admin/security/page.tsx`
- `/admin/services` — `src/app/admin/services/page.tsx`
- `/admin/settings/admins` — `src/app/admin/settings/admins/page.tsx`
- `/admin/transparency` — `src/app/admin/transparency/page.tsx`
- `/admin/trust/[id]` — `src/app/admin/trust/[id]/page.tsx`
- `/admin/trust` — `src/app/admin/trust/page.tsx`
- `/admin/users/[id]` — `src/app/admin/users/[id]/page.tsx`
- `/admin/users` — `src/app/admin/users/page.tsx`
- `/admin/verifications` — `src/app/admin/verifications/page.tsx`
- `/admin/viewings` — `src/app/admin/viewings/page.tsx`
- `/applications` — `src/app/applications/page.tsx`
- `/auth/forgot-password` — `src/app/auth/forgot-password/page.tsx`
- `/auth/mfa` — `src/app/auth/mfa/page.tsx`
- `/auth` — `src/app/auth/page.tsx`
- `/auth/reset-password` — `src/app/auth/reset-password/page.tsx`
- `/auth/verify-email` — `src/app/auth/verify-email/page.tsx`
- `/blog/[slug]` — `src/app/blog/[slug]/page.tsx`
- `/blog` — `src/app/blog/page.tsx`
- `/dashboard/applicants` — `src/app/dashboard/applicants/page.tsx`
- `/dashboard/buyers` — `src/app/dashboard/buyers/page.tsx`
- `/dashboard/imports/[jobId]` — `src/app/dashboard/imports/[jobId]/page.tsx`
- `/dashboard/imports/new` — `src/app/dashboard/imports/new/page.tsx`
- `/dashboard/imports` — `src/app/dashboard/imports/page.tsx`
- `/dashboard/listings/[id]/applicants` — `src/app/dashboard/listings/[id]/applicants/page.tsx`
- `/dashboard/listings/[id]/edit` — `src/app/dashboard/listings/[id]/edit/page.tsx`
- `/dashboard/listings/new` — `src/app/dashboard/listings/new/page.tsx`
- `/dashboard/organization` — `src/app/dashboard/organization/page.tsx`
- `/dashboard` — `src/app/dashboard/page.tsx`
- `/dashboard/viewings` — `src/app/dashboard/viewings/page.tsx`
- `/issue4-test` — `src/app/issue4-test/page.tsx`
- `/journey` — `src/app/journey/page.tsx`
- `/lister/[id]` — `src/app/lister/[id]/page.tsx`
- `/listing/[id]` — `src/app/listing/[id]/page.tsx`
- `/listings` — `src/app/listings/page.tsx`
- `/live-tours/[id]` — `src/app/live-tours/[id]/page.tsx`
- `/messages/[id]` — `src/app/messages/[id]/page.tsx`
- `/messages` — `src/app/messages/page.tsx`
- `/neighborhoods/[slug]` — `src/app/neighborhoods/[slug]/page.tsx`
- `/offers/[id]` — `src/app/offers/[id]/page.tsx`
- `/offers` — `src/app/offers/page.tsx`
- `/onboarding` — `src/app/onboarding/page.tsx`
- `/organization/invite` — `src/app/organization/invite/page.tsx`
- `/` — `src/app/page.tsx`
- `/policy-acceptance` — `src/app/policy-acceptance/page.tsx`
- `/post/entries/[category]/[id]` — `src/app/post/entries/[category]/[id]/page.tsx`
- `/post/entries/[category]` — `src/app/post/entries/[category]/page.tsx`
- `/post/entries` — `src/app/post/entries/page.tsx`
- `/post/listings` — `src/app/post/listings/page.tsx`
- `/post/offers/[id]` — `src/app/post/offers/[id]/page.tsx`
- `/post/offers` — `src/app/post/offers/page.tsx`
- `/post` — `src/app/post/page.tsx`
- `/post/services/[id]` — `src/app/post/services/[id]/page.tsx`
- `/post/services` — `src/app/post/services/page.tsx`
- `/privacy` — `src/app/privacy/page.tsx`
- `/profile/activity` — `src/app/profile/activity/page.tsx`
- `/profile/documents` — `src/app/profile/documents/page.tsx`
- `/profile/edit` — `src/app/profile/edit/page.tsx`
- `/profile/notifications` — `src/app/profile/notifications/page.tsx`
- `/profile` — `src/app/profile/page.tsx`
- `/profile/reviews` — `src/app/profile/reviews/page.tsx`
- `/profile/verification` — `src/app/profile/verification/page.tsx`
- `/saved` — `src/app/saved/page.tsx`
- `/services` — `src/app/services/page.tsx`
- `/settings/[section]` — `src/app/settings/[section]/page.tsx`
- `/settings` — `src/app/settings/page.tsx`
- `/specials/[id]` — `src/app/specials/[id]/page.tsx`
- `/terms` — `src/app/terms/page.tsx`
- `/trust/[slug]` — `src/app/trust/[slug]/page.tsx`
- `/trust` — `src/app/trust/page.tsx`
- `/u/[username]` — `src/app/u/[username]/page.tsx`
- `/viewings/[id]/live` — `src/app/viewings/[id]/live/page.tsx`

## Final local verification

196 focused regression tests passed, with affected suites rerun successfully after continuation fixes. TypeScript, changed-file lint, the production build, and both JavaScript budgets passed. Initial home JavaScript: 295.1 KB compressed (300 KB budget). 145 distinct recorded browser checks passed with no page errors; 132 screenshots include all 80 base screen/theme/width combinations. The review gallery selectors also passed a browser check. Expanded map controls were measured against the panel bounds at 1024 and 1440px.

The next action is user review of the representative set. Do not expand the redesign or deploy it without that next approval.
