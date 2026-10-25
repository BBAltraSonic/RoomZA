# Pinpoint page inventory

16 October 2026. **93 page route patterns** found in the current source, including untracked pages. Parameters in square brackets represent dynamic pages, not single URLs. API endpoints are not pages. This is a source inventory, not proof of signed-in access to every page.

Ordinary pages receive a subtle 120ms opacity arrival after a client navigation commits. There is no exit delay, initial-load animation, page travel, blur, or remount. Headers and mobile tabs remain outside the animated wrapper. Map discovery, active conversations, live viewing/tour routes and the diagnostic page retain immediate rendering and their existing local motion. Reduced motion disables the new arrival completely. Query changes, hashes, refreshes and ordinary rerenders do not trigger it.

Redirect routes render their destination; destination motion policy applies. Additional configured aliases: `/login`, `/signup`, `/register` → `/auth`.

## Discovery and public pages

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/` | Browse Rentals on the Map | Immediate |
| `/issue4-test` | Browser test studio | Immediate |
| `/lister/[id]` | /lister/[id] | 120ms fade |
| `/listing/[id]` | Listing Unavailable / Pinpoints | 120ms fade |
| `/listings` | Browse Listings | 120ms fade |
| `/neighborhoods/[slug]` | Neighborhood Not Found | 120ms fade |
| `/offers` | Specials | Immediate |
| `/offers/[id]` | Shopping Offer | 120ms fade |
| `/services` | Nearby Services | Immediate |
| `/specials/[id]` | /specials/[id] | 120ms fade |
| `/u/[username]` | Profile not found | 120ms fade |

## Account access

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/account-suspended` | /account-suspended | 120ms fade |
| `/auth` | Sign In | 120ms fade |
| `/auth/forgot-password` | Reset password | 120ms fade |
| `/auth/mfa` | /auth/mfa | 120ms fade |
| `/auth/reset-password` | Choose a new password | 120ms fade |
| `/auth/verify-email` | /auth/verify-email | 120ms fade |
| `/onboarding` | Your account | 120ms fade |
| `/organization/invite` | /organization/invite | 120ms fade |
| `/policy-acceptance` | /policy-acceptance | 120ms fade |

## Administration

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/admin` | Admin overview | 120ms fade |
| `/admin/applications` | /admin/applications | 120ms fade |
| `/admin/audit` | /admin/audit | 120ms fade |
| `/admin/blog` | Blog / Pinpoints admin | 120ms fade |
| `/admin/blog/[id]/edit` | Edit blog post / Pinpoints admin | 120ms fade |
| `/admin/entries` | /admin/entries | 120ms fade |
| `/admin/inbox` | /admin/inbox | 120ms fade |
| `/admin/listings` | /admin/listings | 120ms fade |
| `/admin/listings/[id]` | /admin/listings/[id] | 120ms fade |
| `/admin/offers` | Pending Shopping Offers | 120ms fade |
| `/admin/offers/[id]` | Review Shopping Offer | 120ms fade |
| `/admin/offers/confirmed` | Confirmed Shopping Offers | 120ms fade |
| `/admin/operations` | /admin/operations | 120ms fade |
| `/admin/privacy-requests` | /admin/privacy-requests | 120ms fade |
| `/admin/privacy-requests/[id]` | /admin/privacy-requests/[id] | 120ms fade |
| `/admin/reports` | /admin/reports | 120ms fade |
| `/admin/reports/[id]` | /admin/reports/[id] | 120ms fade |
| `/admin/security` | /admin/security | 120ms fade |
| `/admin/security/mfa/challenge` | /admin/security/mfa/challenge | 120ms fade |
| `/admin/security/mfa/setup` | /admin/security/mfa/setup | 120ms fade |
| `/admin/services` | Review Local Services | 120ms fade |
| `/admin/settings/admins` | /admin/settings/admins | 120ms fade |
| `/admin/transparency` | /admin/transparency | 120ms fade |
| `/admin/trust` | /admin/trust | 120ms fade |
| `/admin/trust/[id]` | /admin/trust/[id] | 120ms fade |
| `/admin/users` | /admin/users | 120ms fade |
| `/admin/users/[id]` | /admin/users/[id] | 120ms fade |
| `/admin/verifications` | /admin/verifications | 120ms fade |
| `/admin/viewings` | /admin/viewings | 120ms fade |

## Messages and transactions

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/applications` | My Applications | 120ms fade |
| `/journey` | Your Journey | Redirect to `/applications?view=progress` |
| `/live-tours/[id]` | Live property tour | Immediate |
| `/messages` | /messages | 120ms fade |
| `/messages/[id]` | /messages/[id] | Immediate |
| `/purchases` | My purchases | 120ms fade |
| `/viewings` | My viewings | 120ms fade |
| `/viewings/[id]/live` | /viewings/[id]/live | Immediate |

## Information and policies

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/blog` | Rental advice | 120ms fade |
| `/blog/[slug]` | Article not found / Pinpoints | 120ms fade |
| `/privacy` | /privacy | Redirect to `/trust/privacy` |
| `/terms` | /terms | Redirect to `/trust/terms` |
| `/trust` | Trust & Safety Centre | 120ms fade |
| `/trust/[slug]` | /trust/[slug] | 120ms fade |

## Listing and organization dashboard

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/dashboard` | Dashboard | 120ms fade |
| `/dashboard/applicants` | Applicants | 120ms fade |
| `/dashboard/buyers` | Applicants: Buyers | 120ms fade |
| `/dashboard/imports` | Listing imports | 120ms fade |
| `/dashboard/imports/[jobId]` | Listing import workspace | 120ms fade |
| `/dashboard/imports/new` | New listing import | 120ms fade |
| `/dashboard/listings/[id]/applicants` | /dashboard/listings/[id]/applicants | 120ms fade |
| `/dashboard/listings/[id]/edit` | Edit Listing / Pinpoints | 120ms fade |
| `/dashboard/listings/new` | New Listing / Pinpoints | 120ms fade |
| `/dashboard/organization` | /dashboard/organization | 120ms fade |
| `/dashboard/viewings` | Viewings | 120ms fade |

## Create and manage listings

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/post` | Create listing | 120ms fade |
| `/post/entries` | Places | 120ms fade |
| `/post/entries/[category]` | /post/entries/[category] | 120ms fade |
| `/post/entries/[category]/[id]` | /post/entries/[category]/[id] | 120ms fade |
| `/post/listings` | My listings | 120ms fade |
| `/post/offers` | /post/offers | 120ms fade |
| `/post/offers/[id]` | /post/offers/[id] | 120ms fade |
| `/post/services` | Your Services | 120ms fade |
| `/post/services/[id]` | Service Draft | 120ms fade |

## Profile, settings and saved items

| Route | Page title or route identifier | Arrival |
| --- | --- | --- |
| `/profile` | Your Profile | 120ms fade |
| `/profile/activity` | Profile Activity | 120ms fade |
| `/profile/documents` | Document Vault | 120ms fade |
| `/profile/edit` | Edit Profile | 120ms fade |
| `/profile/notifications` | Your notifications | 120ms fade |
| `/profile/reviews` | Profile Reviews | 120ms fade |
| `/profile/verification` | Profile Verification | 120ms fade |
| `/saved` | Saved Properties | 120ms fade |
| `/settings` | /settings | Redirect to `/settings/profile` |
| `/settings/[section]` | Settings | 120ms fade |

## Relevant navigation journeys

- Explore → Saved, Create, Messages or Profile: destination arrival; returning to discovery is immediate.
- My listings → category workspace → editor; profile → settings or documents; dashboard/admin sections → detail: short arrival on pathname changes.
- Sign in ↔ password recovery and public information → policy pages: short arrival; no form-submit changes.
- Discovery filters, `listingId`/`detailId`, map state and detail-sheet gestures: no route-wide animation. Existing sheet transitions stay in control.
- Conversations, live viewings and live tours: no new page-wide motion.

See [local verification](C:/Users/BB/Documents/Codex/2026-10-16/new-chat-2/outputs/verification.md) for local evidence and limits. The machine-readable inventory includes source paths and motion policy for every route.

## Implementation checkpoint

Shared runtime: src/lib/motion/provider.tsx. This scheduled task is complete locally. 54 focused tests, TypeScript, scoped lint, production build and both JavaScript budgets passed. Initial home JS is 295.3 KiB compressed; the matching prior source build was 295.1 KiB (+260 bytes). Desktop/mobile browser checks passed with and without reduced motion. No deployment occurred. On subsequent runs, recheck inventory and regressions without adding duplicate route motion or expanding the pending redesign review.

