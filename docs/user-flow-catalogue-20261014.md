# RoomZA user-flow catalogue

Inventory date: 14 October 2026.

This catalogue contains 148 grouped journeys across 17 areas in the current RoomZA audit. A grouped journey can contain several paths. Places and Events each need their own category run, and rental and sale variants need separate runs wherever their behavior differs. This is a flow inventory, not a declaration that every flow works or is available in production. Some paths depend on permissions, feature flags, external providers or device capabilities.

Guests can browse public content. A single ordinary account can browse, save, enquire and create listings across Property, Services, Shopping Specials, Places and Events. Listing ownership, publishing review, consent, suspension and administrative permissions determine the actions available.

For every applicable journey, include success; cancellation/back navigation; loading, empty and unavailable states; invalid input; failed request and retry; uncertain response and duplicate submission; refresh/revisit; expired session; stale or conflicting data; and unauthorized or cross-account access. Check keyboard/focus, phone/tablet/desktop layouts, light/dark mode and reduced motion. Where a feature is configurable, include enabled and disabled states. Provider/device completion must be tested separately from simulated responses.

| ID | Area | Grouped flows |
| --- | --- | ---: |
| D | Guest discovery | 10 |
| A | Account access | 12 |
| P | Public property details | 9 |
| R | Rental application | 10 |
| B | Purchase journey | 9 |
| M | Messaging and calls | 7 |
| I | Instant Connect showings | 5 |
| O | Property owner work | 10 |
| T | Live tours | 5 |
| S | Services | 6 |
| H | Shopping Specials | 8 |
| E | Places and Events | 8 |
| G | Organizations and imports | 10 |
| F | Profile and trust | 8 |
| N | Notifications and settings | 12 |
| X | Admin/reviewer operations | 12 |
| U | Public information and global robustness | 7 |

## D: Guest discovery

- D01: Enter all five categories through shared navigation.
- D02: Search location by partial/typo input, select suburb/town/city, clear/change location.
- D03: Switch Property Rent/Buy and preserve applicable query state.
- D04: Search, filter, sort, clear filters, paginate loaded results.
- D05: Move/zoom map, select pin/card, open details, close/back with results/focus restored.
- D06: Open/reload shared property and special links.
- D07: Browse `/listings` rentals/sales and return to map.
- D08: Legacy Feed URLs render current map design with location/search/pagination retained.
- D09: No results, invalid place, API failure, map failure and retry.
- D10: Mobile results sheet peek/browse/full, detail sheet, keyboard controls, category state retention.

## A: Account access

- A01: Fresh registration, validation, consent, session and no role selector.
- A02: Password sign-in and requested destination return.
- A03: Google initiation, consent/callback/session, safe return, failure recovery.
- A04: Protected guest action, sign-in, return and resume intended action.
- A05: Password recovery email/link, invalid/expired link, password update and new login.
- A06: Invalid credentials, lockout/throttling, uncertain submission and retry.
- A07: Required MFA challenge and invalid/expired code.
- A08: Required policy acceptance and continued destination.
- A09: Sign out, expired session, sign out other/all sessions.
- A10: Suspended account notice and restored account access.
- A11: Legacy login/signup/register/onboarding/verify-email redirects.
- A12: Ordinary account can consume/list in all categories without privilege escalation.

## P: Public property details

- P01: Photos/gallery, missing image, full details, amenities, address and availability.
- P02: Rental total monthly costs.
- P03: Sale bond calculator inputs, invalid values and estimate.
- P04: Save/unsave, persisted Saved homes collection, guest return.
- P05: Native share, copy fallback, manual-copy fallback and cancelled share.
- P06: Owner public profile and consented external contact links.
- P07: Property/photo reporting and authentication return.
- P08: Available/scheduled tour entry.
- P09: Unpublished, deleted, restricted and unavailable property links.

## R: Rental application

- R01: Eligibility success and owner/self, duplicate, inactive and restricted denial.
- R02: Applicant/income/employment/move-in/household validation.
- R03: Required ID/payslip upload, invalid type/size, failed upload recovery.
- R04: Submit once, persist and recover uncertain response.
- R05: Five-active-application cap and permitted withdrawal.
- R06: Applications list and progress view, refresh and empty/error states.
- R07: Owner status transitions and applicant update visibility.
- R08: Application conversation entry and messaging.
- R09: Viewing proposal, slot booking, conflict, booking persistence and join.
- R10: Withdrawal permitted/forbidden states and notification outcome.

## B: Purchase journey

- B01: Sale discovery, save and purchase progress persistence.
- B02: Contact seller, create/reuse conversation and buyer interest.
- B03: Request viewing interest without falsely marking a booked viewing.
- B04: Seller sends real slots; buyer receives/selects/books invitation.
- B05: Atomic booking conflict, foreign invitation denial and retries.
- B06: Purchases overview: populated/empty/error/return, no cross-account records.
- B07: Pipeline interested/negotiating/accepted/declined changes and buyer visibility.
- B08: Progress milestones through purchase completion, with truthful action triggers.
- B09: Buyer video room access and correct seller/buyer back destination.

## M: Messaging and calls

- M01: Conversations list, enquiry/application/purchase entry and authorization.
- M02: Send/receive, optimistic/realtime deduplication, refresh and unread state.
- M03: Transport failure, empty/invalid/oversize message, retry and session loss.
- M04: Voice/video initiation, accept/join, decline, end and missed call.
- M05: Camera/microphone denial, unavailable peer, disconnection and recovery.
- M06: Viewing actions from conversation and restrictions before application.
- M07: Message report, block/mute behavior, cross-account denial.

## I: Instant Connect showings

- I01: Owner availability and client-visible connection options.
- I02: Request now/15/30 minutes/today and receive owner response.
- I03: Owner accept/decline, associated conversation and expiry.
- I04: Location permission, proximity check-in, unavailable/denied/out-of-range recovery.
- I05: Complete/cancel showing with state/participant restrictions.

## O: Property owner work

- O01: Create rental/sale quick drafts and resume full editor.
- O02: Details/location/pricing/amenities/consent validation and persisted save.
- O03: Photo upload/delete, failure and media publication rules.
- O04: Readiness, publication, unpublication and public discovery.
- O05: Edit published/draft records, stale conflict and no duplicate draft.
- O06: Archive/restore/duplicate/delete lifecycle and access controls.
- O07: Dashboard statuses, counts, insights and no-data/error recovery.
- O08: Single/all applicant queues, permitted document viewing and decisions.
- O09: Rental viewing proposal and owner booking overview.
- O10: Seller buyer pipeline, private notes, conversation and proposals.

## T: Live tours

- T01: Host starts/schedules/starts scheduled/cancels/ends tour.
- T02: Viewer join and scheduled/ended/unavailable/access-denied branches.
- T03: Recording consent grant/withdrawal, participant changes and no-consent denial.
- T04: Start/finish recording, recording link and disabled configuration.
- T05: Reminder, schedule changes and stale/ended tour suppression.

## S: Services

- S01: Discovery/detail/location/media and consented contacts.
- S02: Create/save draft, validation, provider/location/contact/media rights.
- S03: Confirm permission, submit privately and pending lock.
- S04: Approve/reject, correction/resubmission and public visibility.
- S05: Withdraw/edit/resubmit approved/pending content and old-version removal.
- S06: Other-owner/revoked/suspended denial, stale conflicts and transport retry.

## H: Shopping Specials

- H01: Location discovery, details, terms, prices, gallery and validity.
- H02: Save/unsave/share and Saved Specials persistence.
- H03: Directions, visit/booking/contact validation and report.
- H04: Create/save/preview draft with shop/location/media/consent validation.
- H05: Confirm authorization, submit, permission review, location review and approval.
- H06: Rejection/correction, material edit, fresh review and withdrawal.
- H07: Scheduled/live/expired/unpublished/needs-confirmation states and exact-time boundaries.
- H08: Owner/reviewer/guest/revoked/suspended denial and conflict recovery.

## E: Places and Events

- E01: Both categories discovery/detail, dates, terms, venue and gallery.
- E02: Save/unsave/share/directions/public contact/visit/booking links.
- E03: Create/save/submit private revision and separate publishing permission.
- E04: Reviewer authority/location/media checks, approval/rejection/unpublish.
- E05: Corrections/replacement revision/withdrawal and no resurrection of stale approval.
- E06: Scheduled/available/ended states and server-clock transitions.
- E07: Wrong-category response, removed detail, network error/retry and retained-result expiry.
- E08: Ownership/revocation/suspension/reviewer boundaries and stale versions.

## G: Organizations and imports

- G01: Create/select organization, add office and permitted membership visibility.
- G02: Invite, accept with correct identity, revoke, expired/revoked invite and denied roles.
- G03: CSV/XLSX/XML/JSON/pasted table/Pinpoint source upload and inspection.
- G04: Column mapping/defaults/responsible agent and durable resume.
- G05: Validate/filter rows, warnings/blockers, edit/revalidate and bulk changes.
- G06: Duplicate skip/replace/merge/import-new and restricted-record denial.
- G07: File/folder/ZIP/HTTPS images, malformed source/archive/URL protections.
- G08: Table/map review, row selection and commit private drafts.
- G09: Final publication/apply confirmation and audit snapshots.
- G10: Cancel/retry/resume, partial completion, CSV/JSON reports and rollback.

## F: Profile and trust

- F01: Private profile counts/activity/completion, all destination links.
- F02: Public identity and private persona detail editing, validation/conflicts.
- F03: Public profile visibility, share, contact request and recipient handling.
- F04: Block/mute/unblock/unmute and interaction restrictions.
- F05: Document type/expiry/upload/download/delete and owner-only access.
- F06: Verification statuses/reasons/expiry and no implied external KYC.
- F07: Private activity pagination/filtering and read failure recovery.
- F08: Qualifying review entitlement, write review, received/written statuses and moderation.

## N: Notifications and settings

- N01: Unread badge, panel/mobile sheet/history, category and All/Unread filters.
- N02: Safe destination, read/mark-all/archive and persisted cursor pagination.
- N03: Contact request handling, reminder cancellation and recipient-only updates.
- N04: Preferences/channels/frequency, mandatory categories and disabled-delivery behavior.
- N05: Real-device push enable/remove, permission denied/unsupported/expired subscription.
- N06: Preview/quiet-hours/timezone and cross-account shared-device isolation.
- N07: Domain notification producers, deduplication, no duplicate call/message alerts.
- N08: Reminders, schedule changes, completed-action cancellation, missed-window expiry.
- N09: Visibility/indexing/review/activity settings and consent/version history.
- N10: Email/phone/password changes, MFA, sessions/devices/security history.
- N11: Connect/disconnect Google and optional passkey create/rename/remove/login.
- N12: Data export, download, tracked correction/deletion/objection/consent withdrawal/cancellation.

## X: Admin/reviewer operations

- X01: Admin sign-in, AAL2 setup/challenge, privilege levels and recovery.
- X02: Overview/inbox, reports, notes, case decisions/status/priority.
- X03: Account suspension/restoration and listing restriction/restoration.
- X04: NSFAS accreditation and evidence-based verification states.
- X05: Service/Shopping/Places/Event review workflows and public outcomes.
- X06: Application/viewing inspection and audited sensitive access grants.
- X07: Delivery retry, import retry/cancel, stale job and authorization rules.
- X08: Privacy request handling and eventual export/deletion outcomes.
- X09: Blog drafts/media/publish/unpublish/delete and public reading.
- X10: Trust drafts/submit/approve/publish/rollback and public policy versions.
- X11: Transparency generation/owner publication and public visibility.
- X12: Audit records, admin promotion/revocation, last-owner protections and MFA recovery.

## U: Public information and global robustness

- U01: Blog index/detail, neighborhoods, Terms/Privacy/Trust documents.
- U02: Legacy lister/Journey redirects and bookmarked query retention.
- U03: Invalid IDs, nonexistent resources, permission denial and expected 404 states.
- U04: All reachable internal links, guest/authenticated navigation, no broken destinations.
- U05: Session loss/recovery, network offline/slow/503, reload and back/forward.
- U06: Keyboard/focus/Escape, responsive overflow, light/dark and reduced motion.
- U07: Production build, asset/runtime compatibility, JS budgets and console/hydration errors.

Testing status and evidence are tracked separately in [the verification audit](user-flow-audit-20261014.md).

