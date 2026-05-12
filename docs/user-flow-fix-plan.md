# RoomZA User Flow Fix Plan

## Goal

Bring all verified RoomZA user flows to a working end-to-end state for both roles: public discovery, auth/onboarding, renter applications, landlord listing/applicant review, chat, viewing scheduling, and browser/runtime quality.

## Phase 1: Fix Blocking Next 16 Route Failures

Files:
- `src/app/dashboard/listings/[id]/applicants/page.tsx`
- `src/app/messages/[id]/page.tsx`
- Audit similar dynamic routes under `src/app/**/[id]/**/page.tsx`

Tasks:
- Update dynamic route page props to treat `params` as a Promise.
- Await `params` before reading `id`.
- Apply the same pattern anywhere else using synchronous dynamic params.
- Re-test applicant queue and message routes with seeded landlord/renter data.

Acceptance:
- `/dashboard/listings/:id/applicants` renders the applicant queue instead of 404.
- `/messages/:id` renders the chat thread instead of 404.
- Dev log has no Next `params.id` runtime errors.

## Phase 2: Repair Application Modal Hydration and Button Semantics

Files:
- `src/features/applications/application-modal.tsx`
- `src/components/ui/button.tsx` if needed
- Call sites in `src/features/map-discovery/discovery-page.tsx`
- Call sites in `src/features/map-discovery/listing-detail-panel.tsx`

Tasks:
- Remove nested `<button>` rendering from `DialogTrigger`.
- Use a single trigger element, either by passing a real child correctly or by using the project button primitive with the right `render`/`nativeButton` behavior.
- Ensure `Apply now` still opens eligibility loading, unauthenticated, not-renter, duplicate, cap-reached, success, and form states.
- Fix the Base UI warning where links are rendered through `Button` as button-like components.

Acceptance:
- Browser dev log has no nested button hydration errors.
- `Apply now` opens reliably from discovery cards and listing detail.
- `Sign In`, `Dashboard`, and similar link-buttons have correct link semantics and no Base UI warning.

## Phase 3: Restore Landlord Applicant Review

Files:
- `src/app/dashboard/listings/[id]/applicants/page.tsx`
- `src/features/applications/actions.ts`
- `src/features/applications/applicant-card.tsx`

Tasks:
- After Phase 1, verify `getMyListing` ownership lookup succeeds.
- Verify `getListingApplicants` returns applications plus renter profile and documents.
- Test applicant state actions: shortlist, decline, approve.
- Confirm revalidation updates the current listing applicant page.
- If the UI does not expose viewing proposal controls, decide whether to add `ProposeViewingModal` to the applicant queue after shortlist.

Acceptance:
- Landlord can open `1 Applicant`.
- Applicant card shows applicant details and document badges.
- Shortlist, decline, and approve update status without errors.
- Message Renter navigates to a working chat thread.

## Phase 4: Restore Chat End to End

Files:
- `src/app/messages/[id]/page.tsx`
- `src/features/chat/actions.ts`
- `src/features/chat/chat-box.tsx`
- `src/features/chat/chat-header.tsx`

Tasks:
- After Phase 1, verify `getConversation` authorizes only the tied renter and landlord.
- Verify `getMessages` loads messages.
- Test landlord starts conversation from applicant card.
- Test renter opens the same conversation path if UI exposes it, or add a clear renter message entry point where appropriate.
- Send a message as one role and verify it persists.
- Verify realtime subscription does not duplicate the optimistic/current user message.

Acceptance:
- Landlord can open chat from applicant queue.
- Renter and landlord can both access only their authorized conversation.
- Sending messages writes to Supabase and renders in the chat UI.

## Phase 5: Reconcile Viewing Scheduling Schema and UI

Files:
- `supabase/migrations/20260505100000_add_viewing_and_analytics_tables.sql`
- `src/features/viewings/actions/propose-viewing-slots.ts`
- `src/features/viewings/actions/book-viewing-slot.ts`
- `src/features/viewings/components/propose-viewing-modal.tsx`
- `src/features/viewings/components/select-viewing-slot.tsx`
- Renter and landlord pages where viewing controls should appear

Tasks:
- Inspect the migration and live schema mismatch.
- Apply or repair the missing viewing tables and policies in Supabase.
- Regenerate `src/lib/supabase/types.ts`.
- Wire landlord viewing proposal UI into the applicant review flow.
- Wire renter slot selection UI into the renter application detail/card flow.
- Confirm notification events are created for proposed and booked viewings.

Acceptance:
- Landlord can propose one or more viewing slots for a shortlisted applicant.
- Renter can see available slots and book one.
- Slot booking is atomic and cannot double-book the same slot.
- Notifications are created for both proposal and booking events.

## Phase 6: Complete Listing Creation and Publishing QA

Files:
- `src/features/listings/listing-form.tsx`
- `src/features/listings/location-picker.tsx`
- `src/features/listings/image-uploader.tsx`
- `src/features/listings/actions.ts`
- `src/features/listings/schema.ts`

Tasks:
- Test creating a draft from empty account through the actual form.
- Test validation for all required fields.
- Test Google location selection and hidden address/lat/lng values.
- Test image upload, delete, and minimum image publishing rule.
- Test publish updates discovery and public listing detail.
- Review Google Maps warning and plan migration from legacy `Autocomplete` to `PlaceAutocompleteElement`.

Acceptance:
- Landlord can create draft, edit it, upload images, publish it, and see it on discovery.
- Publishing fails clearly until required data and minimum images are present.
- No blocking map/location errors appear in browser testing.

## Phase 7: Complete Renter Application QA

Files:
- `src/features/applications/application-modal.tsx`
- `src/features/applications/actions.ts`
- `src/app/applications/page.tsx`
- `src/features/applications/withdraw-button.tsx`

Tasks:
- Test unauthenticated apply prompt.
- Test landlord cannot apply.
- Test renter happy-path application with real small PDF/image uploads.
- Test invalid/missing documents.
- Test duplicate application gating.
- Test five-active-application cap.
- Test withdrawal frees an application slot.

Acceptance:
- Renter can submit a valid application with documents.
- Application appears on renter dashboard and landlord applicant queue.
- All blocked states show correct user-facing messages.

## Phase 8: Security and Supabase Verification

Files:
- Supabase migrations and RLS policies
- `src/lib/supabase/types.ts`
- Server actions under `src/features/**/actions.ts`

Tasks:
- Verify RLS for profiles, listings, listing images, applications, documents, conversations, messages, viewing slots, and notifications.
- Confirm landlords can access only their own listing applicants/documents.
- Confirm renters can access only their own applications/conversations.
- Confirm no service-role key is exposed to client code.
- Run Supabase security/performance advisors after schema fixes.

Acceptance:
- Cross-role and cross-user access attempts fail.
- Advisors have no critical unresolved issues relevant to changed tables.

## Phase 9: Automated and Browser Verification

Commands:
- `npm run lint`
- `npm run build`
- Browser pass at `http://127.0.0.1:3002`

Browser matrix:
- Anonymous: discovery, auth, protected redirects.
- New renter: signup, onboarding, applications empty state.
- New landlord: signup, onboarding, dashboard empty state.
- Landlord: create listing, edit, upload images, publish, applicant review, shortlist/approve/decline, propose viewing, chat.
- Renter: discover listing, apply, duplicate blocked, dashboard status, book viewing, withdraw, chat.

Acceptance:
- All flows from `docs/browser-user-flow-report.md` are re-run.
- Failed rows in that report become Pass.
- New report is saved with evidence and any remaining risks.

## Recommended Fix Order

1. Dynamic route params.
2. Application modal/button hydration issues.
3. Applicant queue and chat.
4. Viewing schema and UI wiring.
5. Listing creation/publishing polish.
6. Renter application edge cases.
7. Supabase security verification.
8. Full lint/build/browser regression pass.
