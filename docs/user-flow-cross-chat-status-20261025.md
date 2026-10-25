# RoomZA / Pinpoint: full user-flow status and continuation
Report date: 25 October 2026, Africa/Johannesburg.

**148 original grouped journeys: 17 locally accepted, 131 still awaiting complete acceptance. The 131 are not 131 unimplemented or untouched journeys.** Significant passing implementation, native-service, browser and visual evidence exists outside the accepted set.

This report uses the original D01 through U07 codes in [the 14 October catalogue](user-flow-catalogue-20261014.md). It preserves the original descriptions and denominator. It reconciles the current audit, retained acceptance reports and the 197 indexed workspace/RoomZA/Pinpoint conversation histories accessible locally, plus the related page-transition conversation. Irrelevant creative/configuration conversations were excluded from the findings. This is the accessible local chat history, not a claim to have searched every conversation on a separate ChatGPT account.

The authoritative saved checkpoint is **25 October 2026 at 11:15:14 SAST** [S1]. This side conversation inspected evidence and created only this report and its companion prompt. It did not rerun application tests, modify product code, update the original checklist, change database state, deploy, or freshly verify the live site. Older results below are recorded historical evidence, not fresh proof against every current file. Source/dependency reconciliation remains necessary before accepting previously open IDs.

## How to read the status

- **Accepted locally:** the original checklist explicitly accepts the named local requirements. Hosted release, external-provider and physical-device completion remain separately tracked.
- **Open:** full acceptance is not recorded. The evidence column describes completed work; the remaining column states what must still be proved or reconciled. Open does not mean the feature is missing.
- **Deferred:** a named portion was explicitly skipped, principally private application-document work. Preserve it as unresolved and continue independent work.
- **External gate:** actual account/provider/device or hosted execution is required. Simulated success, native database state, production HTTP smoke and fixture browser checks cannot substitute for that gate.

There is no defensible disjoint total for “failed / blocked / partly tested / never tested” in the inherited tracker. These conditions overlap within grouped journeys, and the tracker has only accepted/open checkboxes. Do not invent an untouched count or add test counts together.

## Scope and accepted totals

| Prefix | Original area | Total | Accepted locally | Open | Accepted IDs |
| --- | --- | ---: | ---: | ---: | --- |
| D | Guest discovery | 10 | 0 | 10 | None formally accepted |
| A | Account access | 12 | 0 | 12 | None formally accepted |
| P | Public property details | 9 | 0 | 9 | None formally accepted |
| R | Rental application | 10 | 0 | 10 | None formally accepted |
| B | Purchase journey | 9 | 0 | 9 | None formally accepted |
| M | Messaging and calls | 7 | 0 | 7 | None formally accepted |
| I | Instant Connect showings | 5 | 0 | 5 | None formally accepted |
| O | Property owner work | 10 | 1 | 9 | O06 |
| T | Live tours | 5 | 0 | 5 | None formally accepted |
| S | Services | 6 | 0 | 6 | None formally accepted |
| H | Shopping Specials | 8 | 0 | 8 | None formally accepted |
| E | Places and Events | 8 | 7 | 1 | E01, E03, E04, E05, E06, E07, E08 |
| G | Organizations and imports | 10 | 9 | 1 | G01, G02, G03, G04, G05, G06, G08, G09, G10 |
| F | Profile and trust | 8 | 0 | 8 | None formally accepted |
| N | Notifications and settings | 12 | 0 | 12 | None formally accepted |
| X | Admin/reviewer operations | 12 | 0 | 12 | None formally accepted |
| U | Public information and global robustness | 7 | 0 | 7 | None formally accepted |
| **Total** | **17 areas** | **148** | **17** | **131** | |

## What has been completed

The accepted set is **O06; E01 and E03-E08; G01-G06 and G08-G10**.

- **O06 owner controls:** actual owner UI archive/restore/duplicate/cancel/delete; buyer/application protection; 13 authorization denials; legitimate owner/admin controls; four declared existing active rental states; actual incoming-buyer/delete lock-order checks; error/focus recovery; shared photo-byte preservation. Six native groups and six actual browser milestones passed. The acceptance verifier checked 7,457 retained parent records. The guard migration remains local and unapplied to shared databases. [S7]
- **Places and Events:** seven of eight original local journeys are accepted. Three retained browser runs provide 50 milestones; the last boundary/session batch passed 24 combined validation conditions. E02 still needs native-sharing completion and reconciliation of its other actions. [S1]
- **Organizations/imports:** organization/office/membership and invitation controls; upload formats; mapping/defaults/resume; row validation and bulk work; duplicates; selected private drafts; exact final publication/audit snapshots; cancellation/retry/resume/report/rollback are accepted locally. G07 remains open. [S1]
- **G10 recovery:** 25 native behaviors; 9 final, 14 partial, 3 first-click and 4 actual two-account tenant browser milestones; 30 outcome measurements. CSV/JSON access, more-than-1,000-row reporting, actual partial completion, rollback truthfulness, legacy refusal, shared-photo preservation and active rental/buyer-history protection have retained proof. Historical failed parents remain failed. [S8]

Material verified work outside the accepted set:

| Area | Recorded implementation and passing evidence | Important limit |
| --- | --- | --- |
| Rental applications and viewing | Older desktop/phone isolated rental journey included new messages, application, viewing proposal/booking, landlord approval and provider reply. Later viewing work passed 13 native rental groups and eight final browser checks. | Full R01-R10 requirements are not all accepted. Private documents are deferred; actual provider/device branches remain separate. [S1] [S4] |
| Purchases | Missing Purchases/Viewings pages, query scoping, sign-in returns, buyer invitations, truthful progress, booking recovery and buyer-data deletion protection were repaired. Five buyer runtime groups and later actual buyer/seller safety actions have evidence. | Complete populated buyer-to-seller browser journey and all milestones remain open. [S1] [S7] [S8] |
| Messaging, calls and relationships | Send/receive/read receipts, duplicate/lost-response recovery, failed-read retry, reconnect and session controls were repaired. Later combined native selection passed 24 message/call/safety groups; nine production-mode relationship browser checks and five linked-progress retry checks passed their strict gates. | Earlier overall failures remain failures. Actual media/permissions/device and complete remaining branch coverage are not inferred. [S1] |
| Instant Connect | Four availability modes, request time options, canonical lost-response recovery, owner response, conversation reuse, terminal updates, cancellation and renewal passed ten final browser checks and 14 native groups. | Location was explicitly emulated. Actual device GPS, hosted delivery/cron and full-ID common coverage are separate. [S1] |
| Live tours | Lifecycle/access/consent/disabled-state and floating-window recovery work passed 31 native groups, 12 headed browser checks and 372 regressions in the later follow-up. | The video provider was a declared local contract fixture. Actual Jitsi/media, recording stop/retention, provider roster and scheduled delivery remain open. [S1] |
| Services | Actual drafts, second-tab photo upload/conflict recovery, permission/location approval, public replacement/gallery and withdrawal passed 24 native groups and 11 headed browser journeys. | S01-S06 remain unchecked; reconcile missing named/common requirements rather than restarting the proven journey. [S1] |
| Shopping Specials | Real owner/reviewer/consumer sessions, TOTP, uploads, draft/review/correction/publication, saved collection, report, replacement/withdrawal and timing/session checks passed 22 native groups and 34 browser milestones. | H01-H08 remain unchecked compound journeys; native sharing, external actions and other unreconciled branches cannot be assumed passed. [S1] |
| Shared discovery sheets | Shared mobile results/detail behavior, category state, focus/scroll/history, gallery and failure recovery: 69 focused tests and 55 fixture-browser checks across four categories, five widths and both themes. | Blank/intercepted map and public API fixtures; actual map/data delivery and physical touch/keyboard are not proved. [S3] |
| Accounts | One ordinary account across five categories, stable draft retry, ownership/revocation/suspension boundaries, actual signup/sign-in and category form paths: 56 database/Auth/REST/browser checks and 690 focused tests. | Actual Google consent and real recovery email remain open. Historical account migration/release was completed later; the older implementation report's “not deployed” line describes its own date. [S2] |
| Notifications | Inbox/badges, preferences, push management, outbox authorization and deduplication were implemented; 228 tests, 72 database checks and browser fixtures were recorded, with later producer/safety checks. | Actual physical-device push and hosted event/reminder/cron delivery are not established by those passes. [S1] [S5] |
| Visual system, navigation and motion | Application-wide charcoal/amber pass, fixture/component/private previews, actual public routes, five widths and an 88-image gallery; 93-page inventory and lightweight transition work were separately recorded. | Static private previews are not authenticated transactions. Safari/touch/notches, current integrated journeys and release remain separate. [S6] |
| Admin, profile, trust and public content | Historical live owner/MFA-setup recovery, clone reviewer TOTP, profile validation/count fixes, trust/privacy/blog infrastructure and many focused tests exist. | No complete current per-ID acceptance is recorded for F01-F08, X01-X12 or U01-U07. |

Counts above overlap across runs, repaired versions and assertions. They measure recorded evidence, not unique completed journeys or a percentage of development effort.

## Known unresolved problems and missing work

1. **G07 HTTPS image safety:** the controlled Node baseline first received a public DNS answer, then the actual HTTPS connection used an owned loopback address and accepted its image. No production transport fix is installed. This is a Node-local reproduction, not proof of a hosted Workers exploit. Choose and verify a transport valid for the configured runtime, preserving certificate/SNI/Host/redirect/timeout/byte-limit behavior. Remaining malformed/archive/image, large/concurrent and pagination variants also need reconciliation. [S9]
2. **Private application documents:** the Storage/document-reference problem and partial pending migration remain unresolved and explicitly deferred. R03/R04, the document part of O08 and related sensitive admin/privacy paths are affected. No weakened permissions or successful document acceptance is implied. Profile-document scope F05 needs its own review; do not assume it is identical to application documents. [S1]
3. **Real external account/provider/device proof:** actual Google consent, password-recovery mail, physical-device push, camera/microphone/media, real GPS/proximity, supported-browser native sharing/passkeys and actual recording/provider behavior remain separate gaps. “Use a test email” did not identify a reachable mailbox or complete those checks.
4. **Hosted execution:** actual notification/event/reminder/expiry delivery and cron/queue execution remain to be verified where required. A binding, configured schedule, test sink or manually invoked database sweep is not actual hosted execution.
5. **Evidence reconciliation:** Services, Specials, messaging/viewings and Instant Connect have substantial passes but no whole-ID acceptance. Check their named requirements and relevant source/dependency changes; close genuinely complete local IDs from existing proof and test only the missing or affected branches.
6. **Final integrated regression and release:** one recorded broad suite on 24 October had 2,122 passed, 5 failed and 257 skipped across 349 files. The failures were three design-class assertions and two application-decision test clients missing auth.getClaims; their relevant inputs matched the then-accepted G09 baseline. This report has not rerun or resolved them. Later focused passes do not convert that broad suite into a pass. Retain the baseline/regression distinction and finish a final integrated gate after the remaining changes. [S1]
7. **Current deployment:** historical October releases of earlier account/discovery/notification work exist. They do not deploy the later audit fixes. The current O06 guard migration is explicitly local/unapplied; no blanket claim that all current repairs are live is justified.
8. **Evidence availability:** the older May browser-user-flow-report.md currently has zero bytes. Its chat claims are historical context, not an intact current acceptance report. Prefer retained raw proof and current reports when available.

The earlier disk-full and Docker Desktop failures were recovered during the parent work, and later O06/G10 runs passed their cleanup/preservation gates. Do not repeat those recovery actions from old chat messages or assume an old PID/session is still active.

## All 148 original journey IDs

Each row keeps its original catalogue wording. The “recorded work” cell summarizes evidence already found; it does not claim every requirement of that row was exercised. “Remaining” is an acceptance/verification requirement, not an assertion that all corresponding code is missing.

### D: Guest discovery

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| D01 | Enter all five categories through shared navigation. | Open | Shared navigation, category creation access and fixture discovery renders have passing coverage. [S1] [S2] [S3] | Reconcile current navigation for all five categories with guest/authenticated entry, return paths and common acceptance checks. |
| D02 | Search location by partial/typo input, select suburb/town/city, clear/change location. | Open | Nationwide catalogue/autocomplete implementation and API/database checks were recorded; location-state regressions also passed. [S1] [S4] | Verify current partial/typo selection and clear/change with authentic stored locations and actual map integration. |
| D03 | Switch Property Rent/Buy and preserve applicable query state. | Open | Rental/sale deep links and filter retention were checked in older desktop/phone journeys. [S1] [S4] | Close the current rent/buy switching matrix, reload/history and applicable-filter retention. |
| D04 | Search, filter, sort, clear filters, paginate loaded results. | Open | Search commit, filters, sorting, URL state and several recovery paths have unit/browser evidence. [S1] [S3] | Reconcile current category-specific combinations, pagination, clear filters and stale-result behavior. |
| D05 | Move/zoom map, select pin/card, open details, close/back with results/focus restored. | Open | Pin/card/detail interactions and back/focus behavior have fixture and older local evidence. [S1] [S3] [S4] | Verify real current map/data behavior and preserve selection, result scroll, focus and URL state through close/Back. |
| D06 | Open/reload shared property and special links. | Open | Property listingId links and category detail/history links have recorded checks. [S1] [S3] [S4] | Complete current property/special sharing-link reload and unavailable-link variants. |
| D07 | Browse `/listings` rentals/sales and return to map. | Open | Older desktop/phone Feed/Map and rent/buy links were checked. [S1] [S4] | Verify current /listings rental and sale entry, populated results and return to the correct map state. |
| D08 | Legacy Feed URLs render current map design with location/search/pagination retained. | Open | Legacy Feed/Map and query-retention work exists in earlier discovery verification. [S1] [S4] | Complete current legacy URL compatibility with place, search, sort and pagination preserved. |
| D09 | No results, invalid place, API failure, map failure and retry. | Open | Discovery error recovery and retained results were repaired; live API CPU recovery was historically deployed. [S1] [S3] | Close the current invalid-place, no-results, failed map/API and retry matrix without treating HTTP smoke as a UI pass. |
| D10 | Mobile results sheet peek/browse/full, detail sheet, keyboard controls, category state retention. | Open | 55 fixture-browser checks and 69 focused tests cover shared sheets, focus/history, five widths and both themes. [S3] | Reconcile current full-category behavior; complete real touch/keyboard/device and live-data gaps separately. |

### A: Account access

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| A01 | Fresh registration, validation, consent, session and no role selector. | Open | Disposable-clone signup, ordinary capability setup and no-role-selection behavior passed. [S2] | Close current validation/consent/session, duplicate/uncertain submission and recovery branches with complete per-ID evidence. |
| A02 | Password sign-in and requested destination return. | Open | Actual password sign-ins and requested returns succeeded in several local journeys. [S1] [S2] | Reconcile current destinations, error states and the earlier intermittent foreign-account return failures. |
| A03 | Google initiation, consent/callback/session, safe return, failure recovery. | Open | Google button initiation was historically deployed and reached Google; callback/redirect tests exist. [S1] [S2] | Complete actual Google consent, callback, session, safe return and cancellation/error recovery with an identified test account. |
| A04 | Protected guest action, sign-in, return and resume intended action. | Open | Guest redirects and many sign-in return paths have passing checks. [S1] [S2] | Verify each intended protected action resumes after sign-in rather than merely opening its page. |
| A05 | Password recovery email/link, invalid/expired link, password update and new login. | Open | Reset-token/expiry and form logic have older automated coverage. [S1] | Complete real recovery-email delivery, valid/invalid/expired links, password update and new login. |
| A06 | Invalid credentials, lockout/throttling, uncertain submission and retry. | Open | Lockout, throttling, generic errors and submission recovery have automated coverage. [S1] [S2] | Close actual current invalid-login/lockout/throttle/uncertain-response browser behavior and configuration gates. |
| A07 | Required MFA challenge and invalid/expired code. | Open | Real clone TOTP reviewer challenges and historical admin MFA setup checks passed. [S1] | Complete current required/invalid/expired challenge, recovery and access-level behavior across affected entry points. |
| A08 | Required policy acceptance and continued destination. | Open | Policy acceptance remains implemented and preserved by account changes. [S1] [S2] | Reconcile actual required-policy acceptance, version changes and continuation to the intended destination. |
| A09 | Sign out, expired session, sign out other/all sessions. | Open | Real POST sign-out, cleared cookies, protected revisit and native expired/revoked-session denial have evidence. [S1] | Close other/all-session revocation and remaining browser expiry/offline diagnostics in the current integration. |
| A10 | Suspended account notice and restored account access. | Open | Suspension and fresh-session boundaries passed in several native/browser category batches. [S1] [S2] | Complete current suspended-account notice, restored access and account-wide recovery proof. |
| A11 | Legacy login/signup/register/onboarding/verify-email redirects. | Open | Legacy onboarding/auth redirects were changed and automatically tested. [S1] [S2] | Close the current complete legacy-route matrix, including signed-in/guest destination and query retention. |
| A12 | Ordinary account can consume/list in all categories without privilege escalation. | Open | 56 database/Auth/REST/browser checks cover shared capabilities and category creation with ownership/review guards retained. [S2] | Reconcile this evidence with current source and close the complete consume/list journey across all categories. |

### P: Public property details

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| P01 | Photos/gallery, missing image, full details, amenities, address and availability. | Open | Property details/gallery and missing-image layouts have component/browser evidence. [S1] [S6] | Complete current populated property photos, missing-photo recovery, metadata, amenities, address and availability as one journey. |
| P02 | Rental total monthly costs. | Open | True Monthly Cost/upfront-cost calculation implementation and automated checks were recorded. [S1] [S4] | Verify rendered rental totals against persisted inputs, missing values and invalid/extreme amounts. |
| P03 | Sale bond calculator inputs, invalid values and estimate. | Open | Sale/bond-calculator implementation exists; no complete current per-ID acceptance was reconciled. [S1] | Verify valid/invalid inputs, estimate changes, labels and persisted sale data without implying a guaranteed financial outcome. |
| P04 | Save/unsave, persisted Saved homes collection, guest return. | Open | Older local saved homes survived reload; listingId and Back behavior were checked. [S1] [S4] | Complete current save AND unsave, collection persistence, guest return, error/retry and unavailable-item branches. |
| P05 | Native share, copy fallback, manual-copy fallback and cancelled share. | Open | Share layout and copy paths have focused/browser evidence in related detail work. [S1] | Complete actual native sharing, user cancellation, clipboard failure and manual-copy fallback. |
| P06 | Owner public profile and consented external contact links. | Open | Public profile/contact-consent behavior was implemented and partly exercised. [S1] | Verify the property-to-owner path and all consented/withheld/invalid external contacts. |
| P07 | Property/photo reporting and authentication return. | Open | Report-form transport/duplicate/target recovery was repaired; moderation tests exist. [S1] | Complete property/photo-specific target validation, authentication return and actual persisted report/access outcomes. |
| P08 | Available/scheduled tour entry. | Open | Tours and property entry controls have local fixture/native coverage. [S1] | Complete available/scheduled/unavailable tour entry from the current property detail, with actual provider proof separately. |
| P09 | Unpublished, deleted, restricted and unavailable property links. | Open | Unpublished/deleted/restricted-resource boundaries have partial native/browser evidence. [S1] | Close the complete current direct-link/reload/error matrix without leaking private content. |

### R: Rental application

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| R01 | Eligibility success and owner/self, duplicate, inactive and restricted denial. | Open | Local application eligibility and actor/listing restrictions have runtime evidence. [S1] [S4] | Reconcile owner/self, duplicate, inactive and restricted denial against the current application entry. |
| R02 | Applicant/income/employment/move-in/household validation. | Open | Application forms/schema and older actual local rental submissions have evidence. [S1] [S4] | Close every listed applicant/income/employment/move-in/household validation and retained-draft branch. |
| R03 | Required ID/payslip upload, invalid type/size, failed upload recovery. | Open - includes deferred scope | Upload-bounds tests and failed Storage/document checks were retained. [S1] | Private application-document work is deferred; complete permitted ID/payslip upload and failed-upload recovery only after that deferral is explicitly resumed. |
| R04 | Submit once, persist and recover uncertain response. | Open - includes deferred scope | Older local application submission succeeded; retry/retention repairs have partial coverage. [S1] [S4] | Close submit-once, persistence and uncertain-response recovery with safe document references; deferred document scope remains unresolved. |
| R05 | Five-active-application cap and permitted withdrawal. | Open | Cap/withdrawal logic and historical duplicate/withdrawal checks exist. [S1] | Verify exact five-active cap, boundary statuses, concurrency and permitted withdrawal in current source. |
| R06 | Applications list and progress view, refresh and empty/error states. | Open | Applications/progress pages rendered in older account journeys; progress-read recovery was tested. [S1] [S4] | Complete current populated/empty/error/reload states and account isolation as one accepted journey. |
| R07 | Owner status transitions and applicant update visibility. | Open | Actual landlord approval/provider response succeeded in an older isolated rental journey. [S1] [S4] | Close all permitted/forbidden owner transitions and current applicant-visible updates/notifications. |
| R08 | Application conversation entry and messaging. | Open | Application conversation entry and two-account messaging have substantial local evidence. [S1] [S4] | Close the linked-application entry, authorization, identity and recovery requirements without rerunning unchanged basic sends. |
| R09 | Viewing proposal, slot booking, conflict, booking persistence and join. | Open | 13 native rental groups and eight final browser checks cover proposal/booking, conflict, persistence and recovery. [S1] | Complete remaining full journey/common checks and actual video-join/provider/device branches where applicable. |
| R10 | Withdrawal permitted/forbidden states and notification outcome. | Open | Withdrawal has historical browser evidence and server rules. [S1] | Close allowed/forbidden statuses, uncertain response, persistence and notification outcome in current source. |

### B: Purchase journey

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| B01 | Sale discovery, save and purchase progress persistence. | Open | Purchases overview/progress repairs and actual sale/buyer fixtures exist. [S1] | Complete populated sale discovery, save and durable purchase progress through the current browser path. |
| B02 | Contact seller, create/reuse conversation and buyer interest. | Open | Actual buyer-interest creation/reuse is covered by native owner/rollback safety runs. [S1] [S7] [S8] | Complete current browser seller contact, one conversation/enquiry on retry and cross-account boundaries. |
| B03 | Request viewing interest without falsely marking a booked viewing. | Open | Buyer controls were repaired to distinguish viewing interest from an actual booking. [S1] | Verify the current persisted and displayed interest state remains truthful before invitation/booking. |
| B04 | Seller sends real slots; buyer receives/selects/books invitation. | Open | Seller invitation/slot and buyer booking work has actual native/browser subset evidence. [S1] | Close the full seller-to-buyer browser handoff and correct persisted invitation/appointment state. |
| B05 | Atomic booking conflict, foreign invitation denial and retries. | Open | Five buyer runtime groups and booking repairs cover atomicity/access/retry subsets. [S1] | Reconcile current conflict, foreign invitation, stale/expired invitation and lost-response branches with browser evidence. |
| B06 | Purchases overview: populated/empty/error/return, no cross-account records. | Open | Missing Purchases page/query scoping/return behavior was repaired. [S1] | Complete populated, empty, failed-read/retry, return and unrelated-account isolation in the current UI. |
| B07 | Pipeline interested/negotiating/accepted/declined changes and buyer visibility. | Open | Interested/negotiating/accepted buyer states are preserved in real native seller/owner safety tests. [S1] [S7] [S8] | Complete the seller pipeline UI, declined transition, buyer visibility and uncertain/stale-response recovery. |
| B08 | Progress milestones through purchase completion, with truthful action triggers. | Open | Purchase-progress persistence and truthful action-trigger repairs have automated/runtime subsets. [S1] | Complete every milestone through purchase completion; a created enquiry or viewing interest is not completion. |
| B09 | Buyer video room access and correct seller/buyer back destination. | Open | Buyer video access/back-route rules have code/native subsets. [S1] | Complete actual eligible/denied room entry and seller/buyer return destinations, with real media proof separately. |

### M: Messaging and calls

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| M01 | Conversations list, enquiry/application/purchase entry and authorization. | Open | Actual conversations/inbox and foreign-account denial passed in multiple local subsets. [S1] | Close each enquiry/application/purchase entry and current list error/session-recovery branches. |
| M02 | Send/receive, optimistic/realtime deduplication, refresh and unread state. | Open | 17 earlier browser checks, eight native message groups and later production-mode recovery cover delivery/retry/read receipts. [S1] | Reconcile current unread/optimistic/realtime identity and remaining common branches; preserve failed overall runs as failed. |
| M03 | Transport failure, empty/invalid/oversize message, retry and session loss. | Open | Stuck-send, same-turn duplicate, lost-response and read-retry defects were repaired with genuine persistence checks. [S1] | Close all empty/invalid/oversize/session-loss branches and any outstanding whole-run console diagnostics. |
| M04 | Voice/video initiation, accept/join, decline, end and missed call. | Open | Start/accept/decline/end/missed and reconnect have native/browser evidence, including later timer diagnostics. [S1] | Complete actual voice/video provider behavior and required scheduler/device outcomes; do not infer media from call state. |
| M05 | Camera/microphone denial, unavailable peer, disconnection and recovery. | Open | Disconnected-status recovery, visible retry and retained call/frame identity passed locally. [S1] | Complete actual camera/microphone permission denial, unavailable peer and real media disconnect/recovery. |
| M06 | Viewing actions from conversation and restrictions before application. | Open | Five final progress-retry checks preserve composer/iframe/draft; viewing proposal/booking subsets pass. [S1] | Reconcile inquiry-before-application restrictions and complete combined viewing/common/provider branches. |
| M07 | Message report, block/mute behavior, cross-account denial. | Open | 24 combined native groups include message/report/relationship safety; nine production-mode relationship checks passed. [S1] | Close complete report/block/mute/unblock/unmute UI/outcome/access requirements and common branches. |

### I: Instant Connect showings

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| I01 | Owner availability and client-visible connection options. | Open | All four owner availability modes, public controls and interrupted-setting recovery passed locally. [S1] | Map accepted subset evidence to this ID and close remaining common/live-integration requirements. |
| I02 | Request now/15/30 minutes/today and receive owner response. | Open | Actual now/15/30/today requests, response loss and canonical recovery passed in ten final browser checks. [S1] | Close complete per-ID common and hosted notification outcomes without repeating unchanged request cases. |
| I03 | Owner accept/decline, associated conversation and expiry. | Open | Actual accept/decline, conversation reuse, expiry/renewal and duplicate-alert recovery passed locally. [S1] | Close remaining current UI/common checks and actual scheduled-expiry/delivery evidence where required. |
| I04 | Location permission, proximity check-in, unavailable/denied/out-of-range recovery. | Open | Denied/distant/nearby location outcomes and check-in were explicitly emulated and passed. [S1] | Complete physical-device location permission, accuracy/proximity and real denied/out-of-range recovery. |
| I05 | Complete/cancel showing with state/participant restrictions. | Open | Owner completion, peer update and requester cancellation of requested/accepted records passed locally. [S1] | Reconcile the full participant/state/common matrix with current source and remaining hosted effects. |

### O: Property owner work

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| O01 | Create rental/sale quick drafts and resume full editor. | Open | Clone signup/category access includes actual rental/sale draft forms and retry-stable IDs. [S1] [S2] | Close quick-draft-to-full-editor resume for both variants and all common branches. |
| O02 | Details/location/pricing/amenities/consent validation and persisted save. | Open | Property save repairs, form validation and location/pricing/amenities/consent subsets passed. [S1] [S2] [S4] | Complete current full persisted editor behavior, field errors, conflicts and authentic location handoff. |
| O03 | Photo upload/delete, failure and media publication rules. | Open | Storage/photo policy and shared-photo lifecycle/rollback preservation have native/browser evidence. [S1] [S7] [S8] | Complete ordinary property photo upload/delete/failure and publication rules, including references and bytes. |
| O04 | Readiness, publication, unpublication and public discovery. | Open | Actual property publication appears in native import/owner/buyer tests; earlier publication work exists. [S1] [S7] [S8] | Complete ordinary owner's readiness/publish/unpublish/public discovery journey in the current UI. |
| O05 | Edit published/draft records, stale conflict and no duplicate draft. | Open | Version/conflict and stable draft/retry fixes have focused/runtime coverage. [S1] [S2] [S4] | Complete ordinary published/draft editor, stale conflict resolution and exactly-one-draft browser outcome. |
| O06 | Archive/restore/duplicate/delete lifecycle and access controls. | Accepted locally | Locally accepted: archive/restore/duplicate/delete, 13 denied access variants, four active rental states, active buyer protection and both buyer/delete lock orders. [S7] | No remaining local O06 acceptance requirement recorded; hosted release, actual device and separate document gates are not implied. |
| O07 | Dashboard statuses, counts, insights and no-data/error recovery. | Open | Dashboard filters/links and some counts/insights were repaired/tested. [S1] | Complete every status/count/insight plus empty/error/retry in the current owner dashboard. |
| O08 | Single/all applicant queues, permitted document viewing and decisions. | Open - includes deferred scope | Older provider applicant queue and decision paths rendered/worked in local rental checks. [S1] [S4] | Complete single/all queues, decisions and permitted documents; private-document scope remains explicitly deferred. |
| O09 | Rental viewing proposal and owner booking overview. | Open | Actual owner proposal/calendar, renter booking and owner schedule have native/browser evidence. [S1] | Reconcile complete owner booking overview and all remaining state/common/provider branches. |
| O10 | Seller buyer pipeline, private notes, conversation and proposals. | Open | Seller edits, buyer enquiry/status safety and proposal subsets have tests/runtime proof. [S1] [S7] [S8] | Complete seller pipeline UI, private-note isolation, conversation and invitation/booking together. |

### T: Live tours

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| T01 | Host starts/schedules/starts scheduled/cancels/ends tour. | Open | Tour start/schedule/cancel/end lifecycle has native and headed fixture-provider coverage. [S1] | Complete all full-ID branches and actual provider/host lifecycle in the intended environment. |
| T02 | Viewer join and scheduled/ended/unavailable/access-denied branches. | Open | Viewer lifecycle/access and unavailable-state checks passed locally. [S1] | Complete actual provider join, scheduled/ended states, denial and device behavior. |
| T03 | Recording consent grant/withdrawal, participant changes and no-consent denial. | Open | Consent grant/withdrawal/no-consent boundaries have native/component/browser subsets. [S1] | Complete actual provider-attested participant roster changes and recording-consent enforcement. |
| T04 | Start/finish recording, recording link and disabled configuration. | Open | Recording/disabled-config contracts and floating-window restoration passed with a declared provider fixture. [S1] | Complete actual recording start/finish/link/stop/retention and real media continuity; fixture state is not recording proof. |
| T05 | Reminder, schedule changes and stale/ended tour suppression. | Open | Reminder/schedule/stale suppression logic has local tests. [S1] | Complete actual hosted scheduling/delivery/cancellation and ended-tour suppression in the configured environment. |

### S: Services

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| S01 | Discovery/detail/location/media and consented contacts. | Open | Service discovery/detail/gallery/contact and unavailable-map recovery passed in local browser work. [S1] | Reconcile all current location/media/contact variants and separate actual maps/external contact/device completion. |
| S02 | Create/save draft, validation, provider/location/contact/media rights. | Open | Actual service drafts, real photo uploads, conflicts, retry recovery and private media boundaries passed. [S1] | Audit remaining fields/common branches against S02 and the current changed dependency set. |
| S03 | Confirm permission, submit privately and pending lock. | Open | Private submit/permission/review state and pending-lock behavior have actual local evidence. [S1] | Reconcile complete submit/consent/pending-lock and recovery requirements for formal per-ID acceptance. |
| S04 | Approve/reject, correction/resubmission and public visibility. | Open | Actual reviewer approval/rejection/correction and guest public snapshots passed locally. [S1] | Close complete reviewer/public outcome branches and common gates without restarting the proven journey. |
| S05 | Withdraw/edit/resubmit approved/pending content and old-version removal. | Open | Actual replacement/resubmission/public snapshot separation and withdrawal passed. [S1] | Reconcile pending/approved variants, old-version removal and current failure/session branches. |
| S06 | Other-owner/revoked/suspended denial, stale conflicts and transport retry. | Open | 24 native groups cover ownership/revocation/suspension/media access; actual two-tab conflicts/recovery passed. [S1] | Reconcile the whole access/stale/transport matrix and any missing common/device/external requirements. |

### H: Shopping Specials

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| H01 | Location discovery, details, terms, prices, gallery and validity. | Open | Actual guest details/gallery/terms/prices and availability/timing browser checks passed. [S1] | Close complete location/discovery/details/common branches and actual map delivery. |
| H02 | Save/unsave/share and Saved Specials persistence. | Open | Actual save/reload, copy-link and unavailable-saved removal passed. [S1] | Complete actual native-share/cancellation/fallback and all save/unsave persistence/recovery branches. |
| H03 | Directions, visit/booking/contact validation and report. | Open | Actual direction/link validation and one persisted moderation report passed. [S1] | Close all visit/booking/contact/report variants and actual external handoffs where required. |
| H04 | Create/save/preview draft with shop/location/media/consent validation. | Open | Actual draft/photos/location/dates/pricing/consent/preview and save recovery passed. [S1] | Reconcile every required validation/common branch to formally accept H04. |
| H05 | Confirm authorization, submit, permission review, location review and approval. | Open | Actual owner/reviewer sign-ins, real TOTP, fresh permission/location evidence and exact-revision approval passed. [S1] | Close all authorization/review variants and remaining current common requirements. |
| H06 | Rejection/correction, material edit, fresh review and withdrawal. | Open | Actual rejection/correction, material edit, fresh review, resubmission and withdrawal passed. [S1] | Reconcile full obsolete-version/public-state and failure/retry coverage against current source. |
| H07 | Scheduled/live/expired/unpublished/needs-confirmation states and exact-time boundaries. | Open | 21 follow-on browser milestones include availability/session and owner-status/time boundaries. [S1] | Complete all scheduled/live/expired/unpublished/needs-confirmation variants and remaining real delivery/common gates. |
| H08 | Owner/reviewer/guest/revoked/suspended denial and conflict recovery. | Open | Foreign poster denial, revoked/suspended/session boundaries and real two-tab conflicts have local evidence. [S1] | Reconcile owner/reviewer/guest/revoked/suspended variants plus failure recovery into full per-ID acceptance. |

### E: Places and Events

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| E01 | Both categories discovery/detail, dates, terms, venue and gallery. | Accepted locally | Locally accepted: both Places and Events discovery/details, dates, terms, venue and gallery. [S1] | Local scope accepted; external maps/providers and physical-device proof remain separate. |
| E02 | Save/unsave/share/directions/public contact/visit/booking links. | Open | Native sharing remains the named open gate; save/directions/contact and category action subsets have evidence. [S1] | Complete actual native sharing/cancellation/fallback plus reconcile save/unsave, public contact and visit/booking variants for BOTH categories. |
| E03 | Create/save/submit private revision and separate publishing permission. | Accepted locally | Locally accepted: create/save/submit private revision with separate publishing permission. [S1] | Local scope accepted; do not infer hosted release or external/device completion. |
| E04 | Reviewer authority/location/media checks, approval/rejection/unpublish. | Accepted locally | Locally accepted: reviewer authority/location/media checks and approve/reject/unpublish. [S1] | Local scope accepted; actual organizational/content authority and hosted deployment remain separate. |
| E05 | Corrections/replacement revision/withdrawal and no resurrection of stale approval. | Accepted locally | Locally accepted: correction/replacement/withdrawal and no stale approval resurrection. [S1] | Local scope accepted; preserve recorded immutable revisions and current dependency boundaries. |
| E06 | Scheduled/available/ended states and server-clock transitions. | Accepted locally | Locally accepted: scheduled/available/ended states and server-clock transitions. [S1] | Local scope accepted; actual hosted scheduling/delivery remains a separate gate. |
| E07 | Wrong-category response, removed detail, network error/retry and retained-result expiry. | Accepted locally | Locally accepted: wrong-category/removed-detail/network retry and retained-result expiry. [S1] | Local scope accepted; retain historical failed parents and the later successful proof separately. |
| E08 | Ownership/revocation/suspension/reviewer boundaries and stale versions. | Accepted locally | Locally accepted: ownership/revocation/suspension/reviewer/stale-version boundaries. [S1] | Local scope accepted; do not repeat unchanged access checks without a changed dependency or new failure. |

### G: Organizations and imports

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| G01 | Create/select organization, add office and permitted membership visibility. | Accepted locally | Locally accepted: organization/office creation, selection and membership visibility. [S1] | Local scope accepted; hosted rollout and physical-device gates remain separate. |
| G02 | Invite, accept with correct identity, revoke, expired/revoked invite and denied roles. | Accepted locally | Locally accepted: invitation identity, accept/revoke/expiry and role denial. [S1] | Local scope accepted; actual external email delivery is separate from invitation-state proof. |
| G03 | CSV/XLSX/XML/JSON/pasted table/Pinpoint source upload and inspection. | Accepted locally | Locally accepted: CSV/XLSX/XML/JSON/pasted-table/Pinpoint upload and inspection. [S1] | Local scope accepted; retain format/malformed-source evidence and parser input contracts. |
| G04 | Column mapping/defaults/responsible agent and durable resume. | Accepted locally | Locally accepted: mapping/defaults/responsible agent and durable resume. [S1] | Local scope accepted; reuse frozen mapping/conflict evidence when inputs match. |
| G05 | Validate/filter rows, warnings/blockers, edit/revalidate and bulk changes. | Accepted locally | Locally accepted: row validation/filtering, warnings/blockers, edits/revalidation and bulk changes. [S1] | Local scope accepted; no full-goal completion follows from this subset. |
| G06 | Duplicate skip/replace/merge/import-new and restricted-record denial. | Accepted locally | Locally accepted: duplicate skip/replace/merge/import-new and restricted-record denial. [S1] | Local scope accepted; preserve matching/transaction evidence and original listing data. |
| G07 | File/folder/ZIP/HTTPS images, malformed source/archive/URL protections. | Open - confirmed local failure | 14 image-upload browser milestones and regressions passed, but a genuine controlled Node DNS-change failure remains; no transport fix is installed. [S9] | Repair and prove runtime-appropriate HTTPS transport; close remaining malformed archive/image, size/concurrency and pagination variants. Node evidence is not hosted exploit proof. |
| G08 | Table/map review, row selection and commit private drafts. | Accepted locally | Locally accepted: ten headed milestones/29 combined conditions for table/map selection and private drafts. [S1] | Local scope accepted; hosted map/queue and actual device gates remain separate. |
| G09 | Final publication/apply confirmation and audit snapshots. | Accepted locally | Locally accepted: eleven headed milestones/19 conditions for exact final selection/publication and audit snapshots. [S1] | Local scope accepted; keep selected-row/readiness/publication receipts and exact counts intact. |
| G10 | Cancel/retry/resume, partial completion, CSV/JSON reports and rollback. | Accepted locally | Locally accepted: 25 native behaviors; final/partial/first-click/two-account tenant browser evidence; reports, rollback and buyer/application/photo preservation. [S8] [S7] | Local scope accepted; hosted delivery/device gates remain separate. Later O06 proof covers its shared command/UI delta. |

### F: Profile and trust

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| F01 | Private profile counts/activity/completion, all destination links. | Open | Profile-count query and mobile profile layout were repaired; older profile work exists. [S1] | Complete private counts/activity/completion and every destination link using current account data. |
| F02 | Public identity and private persona detail editing, validation/conflicts. | Open | Profile validation/editing/conflict-related code and automated tests exist. [S1] | Complete persisted public/private persona editing, invalid fields, stale conflicts and session/access behavior. |
| F03 | Public profile visibility, share, contact request and recipient handling. | Open | Actual public-profile visits and relationship controls passed in production-mode local browser work. [S1] | Complete profile visibility/share, contact request and actual recipient handling as a full journey. |
| F04 | Block/mute/unblock/unmute and interaction restrictions. | Open | Bidirectional Block/Unblock and Mute eligibility passed native groups; interrupted Unblock/retry passed browser checks. [S1] | Close full block/mute/unblock/unmute interactions across all affected surfaces and accounts. |
| F05 | Document type/expiry/upload/download/delete and owner-only access. | Open | Document schema/access/security groundwork exists; application-document work is unresolved and deferred. [S1] | Reconcile profile-document scope independently; verify type/expiry/upload/download/delete/owner-only behavior without silently resuming deferred application documents. |
| F06 | Verification statuses/reasons/expiry and no implied external KYC. | Open | Trust/verification implementation and historical security tests exist. [S1] | Complete actual status/reason/expiry UI and transitions; do not imply an external KYC verification occurred. |
| F07 | Private activity pagination/filtering and read failure recovery. | Open | Activity/query infrastructure exists; no full current per-ID acceptance proof was reconciled. [S1] | Verify account-only activity pagination/filtering, empty/error states and read retry. |
| F08 | Qualifying review entitlement, write review, received/written statuses and moderation. | Open | Review entitlement/moderation implementation exists; no complete current journey was reconciled. [S1] | Verify qualifying entitlement, create/retry, received/written statuses, denial and moderation outcomes. |

### N: Notifications and settings

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| N01 | Unread badge, panel/mobile sheet/history, category and All/Unread filters. | Open | Inbox/badges/mobile layouts and notification regressions/fixtures have passing coverage. [S1] [S5] | Complete current persisted unread/category/All-Unread/history behavior with actual recipient data. |
| N02 | Safe destination, read/mark-all/archive and persisted cursor pagination. | Open | Recipient queries, safe-target handling and notification state/read helpers were repaired/tested. [S1] [S5] | Complete actual navigate/read/mark-all/archive and durable cursor pagination with access/retry proof. |
| N03 | Contact request handling, reminder cancellation and recipient-only updates. | Open | Contact/reminder/outbox subsets and recipient-isolation checks exist. [S1] [S5] | Complete actual request handling, cancellation and recipient-only UI updates. |
| N04 | Preferences/channels/frequency, mandatory categories and disabled-delivery behavior. | Open | Preferences/channels/reminders/push management were implemented and tested with fixtures. [S5] | Close actual persisted preferences, frequency, mandatory categories and disabled-delivery branches. |
| N05 | Real-device push enable/remove, permission denied/unsupported/expired subscription. | Open | Push preference/subscription/device-management code and automated checks exist. [S5] | Complete actual physical-device enable/remove, denied/unsupported permission and expired subscription recovery. |
| N06 | Preview/quiet-hours/timezone and cross-account shared-device isolation. | Open | Preview/quiet-hours/timezone/settings work has implementation/automated coverage. [S5] | Verify actual previews, scheduling boundaries and cross-account isolation on a shared device. |
| N07 | Domain notification producers, deduplication, no duplicate call/message alerts. | Open | Authorized server outbox, recipient isolation, retry deduplication and 82 notification assertions passed in local subsets. [S1] [S5] | Reconcile every domain producer and actual hosted delivery, with no duplicate message/call alerts. |
| N08 | Reminders, schedule changes, completed-action cancellation, missed-window expiry. | Open | Reminder cancellation/schedule/stale suppression rules have local tests. [S1] [S5] | Complete actual configured cron/delivery, changed schedules, completed actions and missed-window expiry. |
| N09 | Visibility/indexing/review/activity settings and consent/version history. | Open | Visibility/consent/settings implementations and source/component evidence exist. [S1] | Complete persisted indexing/review/activity choices and consent/version history/access/recovery. |
| N10 | Email/phone/password changes, MFA, sessions/devices/security history. | Open | Auth/security/session/MFA pieces were implemented and partly exercised. [S1] | Complete actual email/phone/password changes, MFA and session/device/security-history outcomes. |
| N11 | Connect/disconnect Google and optional passkey create/rename/remove/login. | Open | Google initiation/callback logic and connected-account/passkey implementation have partial evidence. [S1] | Complete actual connect/disconnect and enabled/disabled passkey create/rename/remove/login in supported browsers. |
| N12 | Data export, download, tracked correction/deletion/objection/consent withdrawal/cancellation. | Open | Privacy/export/request infrastructure and historical security checks exist. [S1] | Complete actual request/download, correction/deletion/objection/withdrawal/cancellation and eventual outcomes; retain deferred sensitive-document boundaries. |

### X: Admin/reviewer operations

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| X01 | Admin sign-in, AAL2 setup/challenge, privilege levels and recovery. | Open | Historical live owner recognition/MFA setup and later real clone TOTP challenges passed. [S1] | Complete current AAL2 setup/challenge, privilege tiers, recovery and denial matrix without using setup smoke as full acceptance. |
| X02 | Overview/inbox, reports, notes, case decisions/status/priority. | Open | Admin console/report/moderation infrastructure and native report persistence exist. [S1] | Complete actual overview/inbox, reports/notes/case status/priority and authorized decision outcomes. |
| X03 | Account suspension/restoration and listing restriction/restoration. | Open | Suspension/restoration and listing restriction rules have native/category coverage. [S1] | Complete admin action-to-user/public outcome, restored access, denial and audit evidence. |
| X04 | NSFAS accreditation and evidence-based verification states. | Open | NSFAS/trust metric implementation and database/security groundwork exist. [S1] | Verify actual evidence-based accreditation states/expiry, reviewer authority and public presentation. |
| X05 | Service/Shopping/Places/Event review workflows and public outcomes. | Open | Actual category reviewer flows passed in Services/Specials/Places/Events local batches. [S1] | Reconcile shared admin entry and every category's correction/review/public outcome/common requirements. |
| X06 | Application/viewing inspection and audited sensitive access grants. | Open - includes deferred scope | Application/viewing metadata/access groundwork exists. [S1] | Complete authorized inspection and audited sensitive grants; private application-document checks remain explicitly deferred. |
| X07 | Delivery retry, import retry/cancel, stale job and authorization rules. | Open | Import retry/cancel and stale job recovery are locally accepted within G10; notification delivery subsets exist. [S1] [S8] | Close admin-specific delivery/import controls, role denial, stale-job truthfulness and hosted effects. |
| X08 | Privacy request handling and eventual export/deletion outcomes. | Open | Privacy handling/export/deletion infrastructure exists; complete outcomes are not accepted. [S1] | Verify authorized request processing, eventual export/deletion and denied sensitive access without bypassing deferred scope. |
| X09 | Blog drafts/media/publish/unpublish/delete and public reading. | Open | Blog draft/media/publishing code, focused tests and historical migration/deployment checks exist. [S1] | Complete actual admin draft/upload/publish/unpublish/delete and public read lifecycle with current source. |
| X10 | Trust drafts/submit/approve/publish/rollback and public policy versions. | Open | Trust policy versioning/review/publication/security groundwork exists. [S1] | Complete actual draft/submit/approve/publish/rollback and public-version behavior; preserve real approval requirements. |
| X11 | Transparency generation/owner publication and public visibility. | Open | Transparency infrastructure exists; no full current per-ID acceptance was reconciled. [S1] | Verify generation, owner publication, access denial and public visibility/removal. |
| X12 | Audit records, admin promotion/revocation, last-owner protections and MFA recovery. | Open | Admin membership/recovery safeguards and historical security checks exist. [S1] | Complete audit persistence, promotion/revocation, last-owner protections and MFA recovery end to end. |

### U: Public information and global robustness

| ID | Original grouped journey | Status | Recorded work/evidence | Remaining |
| --- | --- | --- | --- | --- |
| U01 | Blog index/detail, neighborhoods, Terms/Privacy/Trust documents. | Open | Public route/browser visual checks and historical blog/trust/terms work passed. [S1] [S6] | Complete every current populated/empty/missing public information path and correct policy/version links. |
| U02 | Legacy lister/Journey redirects and bookmarked query retention. | Open | Legacy Journey/onboarding/lister and discovery URL compatibility have partial tests. [S1] [S2] | Close every original legacy route and bookmarked-query retention against current routing. |
| U03 | Invalid IDs, nonexistent resources, permission denial and expected 404 states. | Open | Many authentic foreign/anonymous/revoked/deleted-resource denials passed. [S1] | Reconcile full invalid-ID/nonexistent/permission/404 route matrix without confusing a failed read with an empty resource. |
| U04 | All reachable internal links, guest/authenticated navigation, no broken destinations. | Open | Historical releases checked 39-53 routes; current fixture/public checks cover many destinations. [S1] [S6] | Audit all reachable current guest/authenticated links, role-specific navigation and no broken destinations. |
| U05 | Session loss/recovery, network offline/slow/503, reload and back/forward. | Open | Offline/reconnect/read-retry, lost-response and history fixes have substantial passing local subsets. [S1] [S3] | Complete cross-app session/network/slow/503/reload/back-forward behavior and unresolved overall console diagnostics. |
| U06 | Keyboard/focus/Escape, responsive overflow, light/dark and reduced motion. | Open | Five-width light/dark/reduced-motion and focus/Escape matrices passed in many subsets; 88-image redesign gallery exists. [S1] [S3] [S6] | Reconcile current whole-app coverage; complete missing real touch/keyboard/Safari/device checks separately. |
| U07 | Production build, asset/runtime compatibility, JS budgets and console/hydration errors. | Open | Repeated isolated builds/typechecks/budgets and clean scoped browser console checks passed, including O06. [S1] [S6] [S7] | Run the final integrated gate after remaining changes; reconcile current suite failures, runtime assets, budgets and console/hydration across the completed scope. |

## Finish order and reporting rules

1. Reconcile the existing evidence and source/dependency scope for one small batch. Preserve all 17 accepted IDs and exact failed baselines. Do not regenerate the inventory or rerun unchanged passing checks merely because another session started.
2. Address G07's real transport defect and the remaining image/archive/pagination cases from its retained checkpoint. If external configuration/provider evidence blocks a branch, state the precise gate and continue independent local work.
3. Close near-complete local batches: Services S01-S06; Specials H01-H08 and E02; Instant Connect I01-I05; then messaging/viewings M01-M07, R09, O09 and relevant buyer paths. Where a whole local ID is already demonstrated with matching relevant inputs and common requirements, record that reconciliation rather than replaying the journey.
4. Complete remaining discovery/account/property/rental/purchase/owner rows, keeping the private-document deferral explicit and moving independent work forward.
5. Complete profile/notifications/settings/admin/public-information rows and the final integrated U-series checks.
6. Complete specifically identified external/hosted/device gates with a designated reachable test account/device. Prepare a scoped release package for separate authorized deployment; do not silently deploy audit changes.

Use an evidence ledger per original ID: implementation state; native proof; browser proof; common UX/access/recovery proof; hosted/provider/device proof where applicable; relevant source/migration hashes; exact failure/blocker; next action. A journey can have both passing local branches and an outstanding external gate. Label those explicitly rather than hiding all progress behind a single empty checkbox.

The original checklist remains the acceptance authority; this report does not itself promote an open ID. The companion [continuation prompt](user-flow-finish-rest-prompt-20261025.md) tells the next main session to finish reconciliation and act on remaining gaps.

## Evidence index

- **S1:** [Current full audit and original checklist][S1] - named native/browser batches, accepted IDs, failed parents, deferred work and latest checkpoint.
- **S2:** [Unified marketplace account implementation/proof][S2] - 56 clone checks and shared-account boundaries; historical deployment status must be read alongside later release records.
- **S3:** [Shared discovery sheet verification][S3] - 55 fixture-browser checks, five widths/two themes, explicit map/device limitations.
- **S4:** [Historical Property baseline][S4] - September desktop/phone saved-home/rental/provider journeys and environment-separated limitations.
- **S5:** [Notification implementation/rollout evidence][S5] - 228 tests/72 database checks, fixtures and actual delivery/device gaps.
- **S6:** [Application-wide redesign verification][S6] - real public versus static private/fixture evidence and source/visual/budget checks. Later functional batches supersede some older “unverified” observations for their exact scope.
- **S7:** [O06 accepted local owner lifecycle evidence][S7] and [machine-readable acceptance](../artifacts/user-flow-property-owner-controls-o06-acceptance.json).
- **S8:** [G10 accepted recovery evidence][S8] and [machine-readable acceptance](../artifacts/user-flow-imports-recovery-g10-acceptance.json).
- **S9:** [G07 controlled network failure and next checkpoint][S9].

Representative cross-chat records reviewed include “List all user flows”, “Continue RoomZA Audit”, “Verify Pinpoint rental journey”, “Continue Pinpoint rental and buying”, “Use property bottom sheet”, “Enable marketplace browsing and-list”, “Finish Marketplace Accounts”, “Add in-app notifications”, “Plan Pinpoint design redesign”, “Build admin feature”, “Build bulk listing migration”, “Verify role flows”, “Commit and deploy all work” and the related continuation/page-transition conversations. A chat's use of “complete” was interpreted within its stated task/environment scope, not as full 148-journey acceptance.

## Source fingerprints captured for this report

These fingerprints identify the inspected saved checkpoint, not a new execution of its tests.

| Inspected source | SHA-256 |
| --- | --- |
| docs/user-flow-catalogue-20261014.md | 46b0e29b8edf32072ceb9ae529d42e0ce95175a9b7b2f7760ad4e7c6274251a2 |
| docs/user-flow-audit-20261014.md | e63e3a28d025f035eae0e5fa0e46b125fe19df12e243aacfcf18ff9695aa9205 |
| docs/user-flow-owner-lifecycle-evidence-20261025.md | bc2835915685f68ec0803d9fdeabb22ceef353775d9730e256d3e3abd8fd7ebd |
| docs/user-flow-import-recovery-evidence-20261025.md | d78977e4087db1f18053cd1c5eaec56274588de3d152a0192507364e5d4837e8 |
| docs/user-flow-import-image-network-next-20261025.md | ecef5225f96f08603b3842ab6b1d1a32bd0a365ae46c48206dd75a0d0ce987c2 |
| artifacts/user-flow-property-owner-controls-o06-acceptance.json | d7cf55ff34c10ca4b48255b0dce372c679eb5faa6bb0f3ca08ef6dc12fb3641e |
| artifacts/user-flow-imports-recovery-g10-acceptance.json | aea2e0e507e529094f7d2e6b3df514b9098ac26ba2209ca28527f358104c093f |

[S1]: user-flow-audit-20261014.md
[S2]: unified-marketplace-20261012.md
[S3]: discovery-sheets-20261014.md
[S4]: pinpoint-property-baseline.md
[S5]: built-in-notifications-20261013.md
[S6]: pinpoint-redesign-20261017/verification.md
[S7]: user-flow-owner-lifecycle-evidence-20261025.md
[S8]: user-flow-import-recovery-evidence-20261025.md
[S9]: user-flow-import-image-network-next-20261025.md

