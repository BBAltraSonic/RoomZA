# RoomZA MVP Build Plan

## Product Summary

- [x] Build a responsive web app for South African rental discovery and application management.
- [x] Make the fullscreen map the default landing surface and keep the map visible through the discovery loop.
- [x] Support the core renter loop: Discover -> Evaluate -> Apply -> Shortlist -> Schedule Viewing.
- [x] Differentiate from broad inventory marketplaces by improving conversion quality through structured applications and a capped renter application supply.

### Locked Product Decisions

- [x] Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, lucide-react.
- [x] Backend: Supabase Auth, Postgres, Storage, Realtime, and Edge Functions where needed.
- [x] Map provider: Google Maps.
- [x] Email provider: Resend.
- [x] Phone verification: Supabase SMS OTP.
- [x] Chat gate: verified renter inquiry or submitted application.
- [x] Active application cap: 5 global active renter applications.
- [x] Currency and timezone defaults: ZAR and Africa/Johannesburg.

## Non-Negotiables

- [x] Map is the default landing surface.
- [x] Applications are structured and document-based.
- [x] Landlords manually review, shortlist, reject, approve, and propose viewings.
- [x] Renters can have no more than 5 active applications globally.
- [x] Renters can withdraw an active application to free one application slot.
- [x] Viewing scheduling happens inside the app.
- [x] Chat is contextual and gated; anonymous messaging is not allowed.
- [x] ID and payslip documents are private and only accessible to the renter and the landlord for the relevant listing.

## MVP Scope

### Renter Experience

- [x] Browse listings on a fullscreen Google Map.
- [x] See price pins for visible listings only.
- [x] Hover or click a pin to highlight the listing.
- [x] Open listing detail without losing the map context.
- [x] Use desktop right-side listing panel and mobile bottom sheet.
- [x] Review carousel, price, address, beds, baths, parking, and bento amenities.
- [x] Start a verified inquiry conversation.
- [x] Apply with verified email, verified phone, structured application fields, ID upload, and payslip upload.
- [x] Track application statuses: submitted, under review, shortlisted, rejected, approved, withdrawn.
- [x] Select a landlord-proposed viewing slot.

### Landlord Experience

- [x] Create and edit listings with required structured fields.
- [x] Choose listing location by Google Places search and draggable map pin.
- [x] Upload at least 3 listing images before publishing.
- [x] Review applicants in a queue per listing.
- [x] See applicant cards with name, income, move-in date, employment, and document status.
- [x] Shortlist, reject, approve, message, and propose viewing slots.
- [x] Receive notifications for applications, messages, and booked viewings.

### Out Of MVP Scope

- [ ] Payments.
- [ ] Reviews and ratings.
- [ ] AI scoring or ranking of renters.
- [ ] Advanced verification beyond email, phone OTP, ID upload, and payslip upload.
- [ ] Lease signing.
- [ ] Advanced multi-property landlord analytics.

## Architecture

Detailed system architecture: [RoomZA System Architecture](./roomza-system-architecture.md)

Linear architecture issue: [CHE-42](https://linear.app/chefleet/issue/CHE-42/design-roomza-mvp-system-architecture)

### App Routes

- [x] `/` map-first discovery page.
- [x] `/listing/[id]` optional deep link that opens the listing while preserving the map.
- [x] `/auth` sign in, sign up, email verification, and phone OTP flows.
- [x] `/dashboard` landlord home.
- [x] `/dashboard/listings/new` create listing flow.
- [x] `/dashboard/listings/[id]/applicants` applicant queue.
- [x] `/applications` renter application tracker.
- [x] `/messages` contextual conversations.

### Core Components

- [x] `MapView`: fullscreen Google Maps surface.
- [x] `PricePin`: custom price marker with hover, selected, and active states.
- [x] `ListingPanel`: desktop side panel and mobile bottom sheet layout.
- [x] `ImageCarousel`: listing image carousel with responsive sizing.
- [x] `AmenitiesBento`: structured amenities grouped by category.
- [x] `ApplicationForm`: profile gate, structured form, document uploads, and submit confirmation.
- [x] `ApplicantCard`: landlord applicant queue item with status actions.
- [x] `CalendarScheduler`: landlord slot creation and renter slot booking.
- [x] `ChatBox`: listing-pinned contextual messaging.
- [x] `NotificationWorker`: immediate and digest notification sender.

### Core Server Actions And RPCs

- [x] `createListing`: create draft listing owned by the current landlord.
- [x] `publishListing`: validate required fields and minimum 3 images before publishing.
- [x] `getListingsInViewport`: fetch published listings inside a bounding box.
- [x] `submitApplication`: validate gates, enforce cap, create application, and attach required documents.
- [x] `withdrawApplication`: mark active application withdrawn and free one cap slot.
- [x] `updateApplicationStatus`: landlord-only status changes for owned listing applicants.
- [x] `createInquiryConversation`: create a gated verified renter inquiry.
- [x] `sendMessage`: append message to an authorized listing conversation.
- [x] `proposeViewingSlots`: landlord creates one or more slots for a shortlisted applicant.
- [x] `bookViewingSlot`: renter books one available proposed slot atomically.

## Database Model

### Tables

- [x] `profiles`: user profile linked to Supabase Auth.
- [x] `listings`: landlord-owned property listing with searchable fields and structured metadata.
- [x] `listing_images`: ordered media for listings.
- [x] `applications`: renter applications per listing.
- [x] `documents`: private application document references.
- [x] `conversations`: inquiry or application conversation scope.
- [x] `messages`: listing-scoped chat messages.
- [x] `viewing_slots`: proposed viewing time windows.
- [x] `viewing_slot_offers`: which application a viewing slot was offered to.
- [x] `viewings`: confirmed viewing bookings.
- [x] `notification_events`: email and digest event queue.
- [x] `analytics_events`: MVP funnel measurement events.

### Required Fields

- [x] `profiles`: id, role, email, phone, phone_verified, created_at.
- [x] `listings`: id, landlord_id, title, price, latitude, longitude, address, bedrooms, bathrooms, parking_type, parking_count, electricity_type, water_availability, lease_duration, availability_date, metadata, status, created_at.
- [x] `listing_images`: id, listing_id, file_url, sort_order, created_at.
- [x] `applications`: id, listing_id, renter_id, status, full_name, income, employment_status, move_in_date, household_size, created_at.
- [x] `documents`: id, application_id, type, file_url, created_at.
- [x] `conversations`: id, listing_id, renter_id, landlord_id, application_id, type, created_at.
- [x] `messages`: id, conversation_id, sender_id, listing_id, content, created_at.
- [x] `viewing_slots`: id, listing_id, start_time, end_time, is_booked, created_at.
- [x] `viewing_slot_offers`: id, slot_id, application_id, created_at.
- [x] `viewings`: id, application_id, slot_id, status, created_at.
- [x] `notification_events`: id, recipient_id, type, payload, sent_at, digest_at, created_at.
- [x] `analytics_events`: id, user_id, event_name, properties, created_at.

### Enums And Statuses

- [x] `role`: renter, landlord.
- [x] `listing_status`: draft, published, archived.
- [x] `application_status`: submitted, under_review, shortlisted, rejected, approved, withdrawn.
- [x] Active application statuses: submitted, under_review, shortlisted, approved.
- [x] `document_type`: id, payslip.
- [x] `conversation_type`: inquiry, application.
- [x] `viewing_status`: booked, cancelled, completed.

## Core Logic

### Application Limit

- [x] Count active applications for the renter using active statuses only.
- [x] If active application count is 5 or more, block submission.
- [x] If the renter already applied to the same listing and the application is active, block duplicate submission.
- [x] If application is withdrawn, remove it from the active cap count.
- [x] Use a database transaction or RPC so concurrent submissions cannot bypass the cap.

### Slot Booking

- [x] Check that the slot was offered to the renter's application.
- [x] Check that the slot is not already booked.
- [x] Atomically mark the slot booked and create the viewing.
- [x] Reject any concurrent booking attempt for an already booked slot.
- [x] Notify landlord after successful booking.

### Chat Gate

- [x] Require authenticated user.
- [x] Require verified email and phone for inquiry conversations.
- [x] Allow conversation access only to the renter and landlord tied to the listing/application.
- [x] Disallow file sharing in MVP chat.

### Notifications

- [x] Create immediate notification events for new application, new message, viewing proposed, and viewing booked.
- [x] Send immediate emails through Resend.
- [x] Include unsent or unread events in a fallback digest.
- [x] Store sent timestamps for audit and retry behavior.

## Milestones

### Week 1 - Foundation

Target date: 2026-05-08

- [x] Scaffold Next.js app with TypeScript, Tailwind, shadcn/ui.
- [x] Configure Supabase clients for browser, server components, route handlers, and server actions.
- [x] Implement email/password auth.
- [x] Implement Supabase SMS OTP phone verification.
- [x] Create profile records and role selection for renter and landlord.
- [x] Add initial database migrations.
- [x] Enable RLS on exposed tables.
- [x] Create public listing image bucket and private document bucket.

### Week 2 - Listings + Map

Target date: 2026-05-15

- [x] Build landlord listing draft creation.
- [x] Add Google Places search and draggable pin for listing location.
- [x] Add structured listing fields and metadata validation.
- [x] Add listing image upload and minimum image validation.
- [x] Publish listings only when required fields are complete.
- [x] Build fullscreen Google Maps landing page.
- [x] Implement viewport-based listing loading.
- [x] Render custom price pins.

### Week 3 - Listing UX

Target date: 2026-05-22

- [x] Build desktop right-side listing panel.
- [x] Build mobile bottom sheet listing panel.
- [x] Add image carousel.
- [x] Add property facts and amenities bento grid.
- [x] Add Apply Now and Message CTAs.
- [x] Support listing deep links while preserving map context.
- [x] Verify responsive layout and map persistence.

### Week 4 - Applications

Target date: 2026-05-29

- [x] Build profile verification gate.
- [x] Build structured application form.
- [x] Upload ID and payslip documents to private storage.
- [x] Enforce 5 active application cap.
- [x] Add withdrawal flow to free a cap slot.
- [x] Add renter application tracker.
- [x] Notify landlord on new application.

### Week 5 - Landlord + Chat

Target date: 2026-06-05

- [x] Build landlord dashboard.
- [x] Build applicant queue per listing.
- [x] Build applicant cards with document status.
- [x] Add shortlist, reject, approve, and message actions.
- [x] Implement inquiry/application-gated conversations.
- [x] Add basic realtime chat.
- [x] Pin listing context at top of chat.
- [x] Notify users on new messages.

### Week 6 - Viewing + Launch QA

Target date: 2026-06-12

- [x] Build landlord viewing slot proposal flow.
- [x] Support bulk slot creation.
- [x] Build renter slot selection.
- [x] Enforce one booking per slot atomically.
- [x] Notify renter when slots are proposed.
- [x] Notify landlord when a slot is booked.
- [x] Add fallback digest notification job.
- [x] Complete unit, integration, E2E, and responsive QA.

## Linear Issue Map

| Epic | Linear Issue | Status | Milestone | Acceptance |
| --- | --- | --- | --- | --- |
| Foundation: Next.js, Supabase, Auth, RLS | [CHE-7](https://linear.app/chefleet/issue/CHE-7/foundation-nextjs-supabase-auth-rls) | Complete | Week 1 - Foundation | Auth, profiles, RLS, and storage are ready for feature work. |
| Map Discovery | [CHE-8](https://linear.app/chefleet/issue/CHE-8/map-discovery) | Complete | Week 2 - Listings + Map | Renters can browse visible listings on a fullscreen map with interactive price pins. |
| Listing Management | [CHE-9](https://linear.app/chefleet/issue/CHE-9/listing-management) | Complete | Week 2 - Listings + Map | Landlords can create and publish valid listings with location and images. |
| Listing Panel UX | [CHE-10](https://linear.app/chefleet/issue/CHE-10/listing-panel-ux) | Complete | Week 3 - Listing UX | Listing detail works as desktop side panel and mobile bottom sheet while map persists. |
| Applications + Documents | [CHE-11](https://linear.app/chefleet/issue/CHE-11/applications-documents) | Complete | Week 4 - Applications | Verified renters can apply with documents and are blocked at 5 active applications. |
| Landlord Review + Chat | [CHE-12](https://linear.app/chefleet/issue/CHE-12/landlord-review-chat) | Complete | Week 5 - Landlord + Chat | Landlords can manage applicants and users can message in gated listing conversations. |
| Viewing Scheduling + Notifications | [CHE-13](https://linear.app/chefleet/issue/CHE-13/viewing-scheduling-notifications) | Complete | Week 6 - Viewing + Launch QA | Shortlisted renters can book proposed viewing slots and emails are sent. |

### Linear Child Issues

- [x] CHE-7 Foundation architecture: [CHE-42](https://linear.app/chefleet/issue/CHE-42/design-roomza-mvp-system-architecture).
- [x] CHE-7 Foundation implementation: [CHE-14](https://linear.app/chefleet/issue/CHE-14/scaffold-nextjs-app-with-typescript-tailwind-and-shadcnui) complete, [CHE-15](https://linear.app/chefleet/issue/CHE-15/configure-supabase-clients-auth-routes-and-profile-creation) complete, [CHE-16](https://linear.app/chefleet/issue/CHE-16/implement-renter-and-landlord-role-based-access) complete, [CHE-17](https://linear.app/chefleet/issue/CHE-17/add-rls-baseline-and-storage-buckets) complete.
- [x] CHE-8 Map Discovery: [CHE-18](https://linear.app/chefleet/issue/CHE-18/implement-fullscreen-mapbox-landing-page) complete, [CHE-19](https://linear.app/chefleet/issue/CHE-19/add-viewport-based-listing-query) complete, [CHE-20](https://linear.app/chefleet/issue/CHE-20/render-custom-price-pins-with-selected-and-hover-states) complete, [CHE-21](https://linear.app/chefleet/issue/CHE-21/support-listing-deep-links-without-removing-the-map) complete.
- [x] CHE-9 Listing Management: [CHE-22](https://linear.app/chefleet/issue/CHE-22/build-landlord-listing-create-and-edit-flow) complete, [CHE-23](https://linear.app/chefleet/issue/CHE-23/add-mapbox-search-and-draggable-listing-location-pin) complete, [CHE-24](https://linear.app/chefleet/issue/CHE-24/validate-listing-fields-and-minimum-3-images) complete, [CHE-25](https://linear.app/chefleet/issue/CHE-25/store-structured-amenities-metadata) complete.
- [x] CHE-10 Listing Panel UX: [CHE-26](https://linear.app/chefleet/issue/CHE-26/build-desktop-right-side-listing-panel) complete, [CHE-27](https://linear.app/chefleet/issue/CHE-27/build-mobile-bottom-sheet-listing-panel) complete, [CHE-28](https://linear.app/chefleet/issue/CHE-28/add-carousel-property-facts-amenities-bento-and-ctas) complete, [CHE-29](https://linear.app/chefleet/issue/CHE-29/verify-responsive-listing-panel-and-map-persistence) complete.
- [x] CHE-11 Applications + Documents: [CHE-30](https://linear.app/chefleet/issue/CHE-30/build-renter-profile-and-verification-gate), [CHE-31](https://linear.app/chefleet/issue/CHE-31/build-structured-application-form), [CHE-32](https://linear.app/chefleet/issue/CHE-32/upload-id-and-payslip-documents-to-private-storage), [CHE-33](https://linear.app/chefleet/issue/CHE-33/enforce-5-active-applications-and-withdrawal-slot-release).
- [x] CHE-12 Landlord Review + Chat: [CHE-34](https://linear.app/chefleet/issue/CHE-34/build-applicant-queue-per-listing), [CHE-35](https://linear.app/chefleet/issue/CHE-35/add-applicant-cards-and-status-actions), [CHE-36](https://linear.app/chefleet/issue/CHE-36/implement-inquiry-and-application-gated-conversations), [CHE-37](https://linear.app/chefleet/issue/CHE-37/add-realtime-chat-with-listing-pinned-at-top).
- [x] CHE-13 Viewing Scheduling + Notifications: [CHE-38](https://linear.app/chefleet/issue/CHE-38/build-landlord-viewing-slot-proposal-flow), [CHE-39](https://linear.app/chefleet/issue/CHE-39/build-renter-slot-selection-flow), [CHE-40](https://linear.app/chefleet/issue/CHE-40/enforce-atomic-one-booking-per-slot-behavior), [CHE-41](https://linear.app/chefleet/issue/CHE-41/send-resend-emails-and-fallback-digest-notifications).

## Test And Acceptance Plan

### Unit Tests

- [ ] Validate listing required fields.
- [ ] Validate minimum 3 listing images before publish.
- [ ] Validate amenities metadata parsing.
- [ ] Validate application cap active status rules.
- [ ] Validate notification event creation payloads.

### Database And Integration Tests

- [ ] RLS allows renters to access their own applications only.
- [ ] RLS allows landlords to access applications only for their own listings.
- [ ] Private documents can be accessed only by the renter and owning landlord.
- [ ] A renter cannot submit more than 5 active applications.
- [ ] Withdrawing an application frees one cap slot.
- [ ] Concurrent slot booking allows only one successful booking.

### End-to-End Tests

- [x] Renter discovers a listing on the map and opens the listing panel.
- [ ] Renter completes verification gate and submits an application with documents.
- [ ] Renter is blocked when trying to exceed 5 active applications.
- [ ] Landlord shortlists an applicant.
- [ ] Renter and landlord exchange gated messages.
- [ ] Landlord proposes viewing slots.
- [ ] Renter books one viewing slot.
- [ ] Landlord receives booked viewing notification.

### Responsive QA

- [x] Desktop map and right-side panel do not overlap incorrectly.
- [x] Mobile bottom sheet occupies 60-70% height and keeps map visible.
- [ ] Primary CTAs remain visible and usable on small screens.
- [ ] Button labels and key UI text do not clip or overflow.

### MVP Success Metrics

- [ ] At least 60% of listings receive at least 1 application.
- [ ] At least 30% of applications are shortlisted.
- [ ] At least 20% of shortlisted applications reach viewing scheduled.

## Linear Project Details

- [ ] Project: [RoomZA MVP](https://linear.app/chefleet/project/roomza-mvp-535dc3b10cd9).
- [ ] Team: Chefleet.
- [ ] Priority: High.
- [ ] Start date: 2026-05-04.
- [ ] Target date: 2026-06-12.
- [ ] Issue structure: 7 parent epics with 28 child implementation issues plus 1 completed architecture issue.
- [ ] Assignment: unassigned by default.

## Implementation Assumptions

- [ ] RoomZA starts as a greenfield app in this workspace.
- [ ] Markdown is the canonical spec and Linear is derived from it.
- [ ] Landlord manual approval means applicant review decisions, not platform approval of landlord accounts.
- [ ] Production legal/privacy copy will be supplied before launch.
- [ ] This folder was not a Git repository when this tracker was created; initialize Git separately if repo tracking is required.
