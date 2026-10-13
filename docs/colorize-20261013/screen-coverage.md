# Colorize screen coverage, 13 October 2026

91 page routes and 480 local dependencies traced, including inherited layouts, loading and error screens. The JSON retains per-route color roles and compatibility exceptions. This is source coverage, not a claim that every authenticated screen was viewed.

| Route | UI files | Color roles | Evidence |
|---|---:|---:|---|
| `/account-suspended` | 1 | 8 | Source audited; see browser results |
| `/admin/applications` | 6 | 31 | Source audited; admin session required |
| `/admin/audit` | 4 | 17 | Source audited; admin session required |
| `/admin/blog` | 8 | 31 | Source audited; admin session required |
| `/admin/blog/[id]/edit` | 9 | 31 | Source audited; record-specific |
| `/admin/entries` | 6 | 14 | Source audited; admin session required |
| `/admin/inbox` | 6 | 31 | Source audited; admin session required |
| `/admin/listings` | 6 | 31 | Source audited; admin session required |
| `/admin/listings/[id]` | 8 | 31 | Source audited; record-specific |
| `/admin/offers/confirmed` | 1 | 1 | Source audited; admin session required |
| `/admin/offers` | 1 | 2 | Source audited; admin session required |
| `/admin/offers/[id]` | 9 | 14 | Source audited; record-specific |
| `/admin/operations` | 8 | 32 | Source audited; admin session required |
| `/admin` | 4 | 17 | Source audited; admin session required |
| `/admin/privacy-requests` | 6 | 31 | Source audited; admin session required |
| `/admin/privacy-requests/[id]` | 8 | 31 | Source audited; record-specific |
| `/admin/reports` | 6 | 31 | Source audited; admin session required |
| `/admin/reports/[id]` | 8 | 31 | Source audited; record-specific |
| `/admin/security/mfa/challenge` | 4 | 16 | Source audited; admin session required |
| `/admin/security/mfa/setup` | 4 | 16 | Source audited; admin session required |
| `/admin/security` | 4 | 17 | Source audited; admin session required |
| `/admin/services` | 5 | 14 | Source audited; admin session required |
| `/admin/settings/admins` | 8 | 31 | Source audited; admin session required |
| `/admin/transparency` | 8 | 31 | Source audited; admin session required |
| `/admin/trust` | 6 | 31 | Source audited; admin session required |
| `/admin/trust/[id]` | 9 | 31 | Source audited; record-specific |
| `/admin/users` | 6 | 31 | Source audited; admin session required |
| `/admin/users/[id]` | 8 | 31 | Source audited; record-specific |
| `/admin/verifications` | 8 | 31 | Source audited; admin session required |
| `/admin/viewings` | 6 | 31 | Source audited; admin session required |
| `/applications` | 16 | 40 | Source audited; see browser results |
| `/auth/forgot-password` | 7 | 22 | Source audited; see browser results |
| `/auth/mfa` | 4 | 15 | Source audited; see browser results |
| `/auth` | 8 | 25 | Source audited; see browser results |
| `/auth/reset-password` | 6 | 22 | Source audited; see browser results |
| `/auth/verify-email` | 1 | 0 | Source audited; see browser results |
| `/blog` | 1 | 7 | Source audited; see browser results |
| `/blog/[slug]` | 4 | 14 | Source audited; record-specific |
| `/dashboard/applicants` | 10 | 35 | Source audited; see browser results |
| `/dashboard/buyers` | 10 | 33 | Source audited; see browser results |
| `/dashboard/imports/new` | 5 | 31 | Source audited; see browser results |
| `/dashboard/imports` | 4 | 30 | Source audited; see browser results |
| `/dashboard/imports/[jobId]` | 9 | 35 | Source audited; record-specific |
| `/dashboard/listings/new` | 10 | 38 | Source audited; see browser results |
| `/dashboard/listings/[id]/applicants` | 8 | 35 | Source audited; record-specific |
| `/dashboard/listings/[id]/edit` | 17 | 47 | Source audited; record-specific |
| `/dashboard/organization` | 6 | 31 | Source audited; see browser results |
| `/dashboard` | 12 | 36 | Source audited; see browser results |
| `/dashboard/viewings` | 9 | 35 | Source audited; see browser results |
| `/issue4-test` | 22 | 55 | Source audited; see browser results |
| `/journey` | 1 | 0 | Source audited; see browser results |
| `/lister/[id]` | 1 | 0 | Source audited; record-specific |
| `/listing/[id]` | 54 | 83 | Source audited; record-specific |
| `/listings` | 8 | 35 | Source audited; see browser results |
| `/live-tours/[id]` | 5 | 32 | Source audited; record-specific |
| `/messages` | 53 | 83 | Source audited; see browser results |
| `/messages/[id]` | 17 | 39 | Source audited; record-specific |
| `/neighborhoods/[slug]` | 5 | 23 | Source audited; record-specific |
| `/offers` | 44 | 39 | Source audited; see browser results |
| `/offers/[id]` | 12 | 20 | Source audited; record-specific |
| `/onboarding` | 1 | 0 | Source audited; see browser results |
| `/organization/invite` | 3 | 17 | Source audited; see browser results |
| `/` | 55 | 83 | Source audited; see browser results |
| `/policy-acceptance` | 2 | 15 | Source audited; see browser results |
| `/post/entries` | 1 | 1 | Source audited; see browser results |
| `/post/entries/[category]` | 3 | 13 | Source audited; record-specific |
| `/post/entries/[category]/[id]` | 9 | 17 | Source audited; record-specific |
| `/post/listings` | 2 | 4 | Source audited; see browser results |
| `/post/offers` | 3 | 13 | Source audited; see browser results |
| `/post/offers/[id]` | 8 | 17 | Source audited; record-specific |
| `/post` | 2 | 4 | Source audited; see browser results |
| `/post/services` | 6 | 17 | Source audited; see browser results |
| `/post/services/[id]` | 6 | 17 | Source audited; record-specific |
| `/privacy` | 1 | 0 | Source audited; see browser results |
| `/profile/activity` | 4 | 30 | Source audited; see browser results |
| `/profile/documents` | 7 | 31 | Source audited; see browser results |
| `/profile/edit` | 8 | 31 | Source audited; see browser results |
| `/profile/notifications` | 7 | 30 | Source audited; see browser results |
| `/profile` | 4 | 31 | Source audited; see browser results |
| `/profile/reviews` | 6 | 31 | Source audited; see browser results |
| `/profile/verification` | 4 | 30 | Source audited; see browser results |
| `/saved` | 23 | 37 | Source audited; see browser results |
| `/services` | 44 | 39 | Source audited; see browser results |
| `/settings` | 1 | 0 | Source audited; see browser results |
| `/settings/[section]` | 12 | 31 | Source audited; record-specific |
| `/specials/[id]` | 12 | 20 | Source audited; record-specific |
| `/terms` | 1 | 0 | Source audited; see browser results |
| `/trust` | 2 | 7 | Source audited; see browser results |
| `/trust/[slug]` | 5 | 8 | Source audited; record-specific |
| `/u/[username]` | 7 | 32 | Source audited; record-specific |
| `/viewings/[id]/live` | 6 | 40 | Source audited; record-specific |
