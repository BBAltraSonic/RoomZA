# RoomZA System Architecture

Status: Draft v1
Date: 2026-05-04
Canonical tracker: [RoomZA MVP Build Plan](./roomza-mvp-build-plan.md)
Linear issue: [CHE-42](https://linear.app/chefleet/issue/CHE-42/design-roomza-mvp-system-architecture)

## 1. Architecture Goals

RoomZA is a map-first rental marketplace MVP. The system should optimize for:

- Fast renter discovery on a fullscreen map.
- Structured, high-quality applications instead of casual leads.
- Strong privacy controls for renter documents.
- Reliable cap enforcement for 5 active renter applications.
- Landlord-driven applicant review and viewing scheduling.
- Simple operational footprint for a lean MVP.

The MVP will be a single Next.js application backed by Supabase services and deployed to Vercel. The app will use server-rendered pages where useful, client components for map/chat-heavy experiences, and database RPCs for rules that must be atomic.

## 2. Chosen Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Web app | Next.js App Router + TypeScript | Supports Server Components, Server Actions, route handlers, and clean route segmentation. |
| Styling/UI | Tailwind CSS, shadcn/ui, lucide-react | Fast composition with accessible primitives and consistent controls. |
| Auth | Supabase Auth | Email/password and Supabase SMS OTP fit MVP requirements. |
| Database | Supabase Postgres | Relational model, RLS, RPCs, transactional rules, and app-owned schema. |
| Storage | Supabase Storage | Public listing images and private application documents. |
| Realtime | Supabase Realtime | Basic contextual chat updates and optional live applicant/message updates. |
| Map/search | Mapbox GL JS + Mapbox Search/Geocoding | Fullscreen map, custom price pins, viewport queries, and landlord location selection. |
| Email | Resend | Transactional notifications from server-only code. |
| Hosting | Vercel | Natural Next.js deployment target, route handlers, and cron jobs. |

## 3. Runtime Topology

```text
Browser
  |-- Next.js pages and client components
  |-- Mapbox GL JS
  |-- Supabase browser client for auth/session, allowed reads, storage upload, realtime
  |
Vercel Next.js App
  |-- Server Components for protected page reads
  |-- Server Actions for form mutations
  |-- Route Handlers for API, signed URLs, webhooks, cron jobs
  |-- Server-only Supabase clients
  |-- Resend notification sender
  |
Supabase
  |-- Auth
  |-- Postgres with RLS and RPCs
  |-- Storage buckets
  |-- Realtime
  |
External Services
  |-- Mapbox map tiles/search/geocoding
  |-- Resend email delivery
```

## 4. Application Structure

Use feature-oriented folders inside `src/` so UI, validation, actions, and data access stay close to the domain they serve.

```text
src/
  app/
    page.tsx
    listing/[id]/page.tsx
    auth/
    dashboard/
    applications/
    messages/
    api/
      listings/route.ts
      documents/[id]/signed-url/route.ts
      cron/notifications/digest/route.ts
  components/
    ui/
    layout/
  features/
    auth/
    listings/
    map/
    applications/
    documents/
    conversations/
    viewings/
    notifications/
    analytics/
  lib/
    config/
    supabase/
      browser.ts
      server.ts
      admin.ts
      middleware.ts
    validation/
    errors/
    dates/
```

### Route Ownership

| Route | Primary owner | Rendering strategy |
| --- | --- | --- |
| `/` | Map discovery | Server shell + client Mapbox component. |
| `/listing/[id]` | Listing detail deep link | Server fetch listing summary, client opens map/panel. |
| `/auth/*` | Auth | Server/client mixed forms using Supabase Auth. |
| `/dashboard` | Landlord | Protected Server Component. |
| `/dashboard/listings/new` | Listing management | Protected form with Server Actions and client map picker. |
| `/dashboard/listings/[id]/applicants` | Applicant review | Protected Server Component with action buttons. |
| `/applications` | Renter applications | Protected Server Component with client interactions. |
| `/messages` | Chat | Protected Server Component shell + client realtime ChatBox. |

## 5. Frontend Architecture

### Component Boundaries

- `MapView` is a client-only component because Mapbox depends on browser APIs.
- `ListingPanel` renders in two responsive shells: desktop side panel and mobile bottom sheet.
- `ApplicationForm`, `ListingForm`, and `CalendarScheduler` use client-side state for interaction but submit through Server Actions.
- `ChatBox` is client-side and subscribes to authorized conversation updates.
- `ApplicantCard` is mostly server-rendered data with client action controls.

### State Model

- URL state owns selected listing where possible: `?listing=<id>` on `/`, plus `/listing/[id]` for shareable deep links.
- Component state owns map hover, temporary form state, bottom sheet position, and optimistic chat messages.
- Database state owns application status, booking state, conversation membership, and notification state.
- Avoid global state until needed. Use React state and URL state for MVP; introduce Zustand only if map/listing panel state becomes awkward.

### Data Fetching Rules

- Public map pins are fetched through `GET /api/listings?bbox=west,south,east,north`.
- Listing detail is fetched by route handler or Server Component through a typed listing service.
- Protected dashboard/application/message pages read through the server Supabase client using the current cookie session.
- Mutations go through Server Actions unless they are API-shaped integrations, cron jobs, or signed URL endpoints.
- Direct browser writes to the database are avoided for core business mutations.

## 6. Backend Architecture

### Supabase Client Types

- `browser.ts`: public anon key, current user session, client-side auth, storage uploads, realtime subscriptions.
- `server.ts`: cookie-aware server client for Server Components, Server Actions, and route handlers.
- `admin.ts`: service role client, server-only, used only for signed document URLs, notification jobs, and admin-safe maintenance.
- `middleware.ts`: refreshes Supabase auth sessions and protects route groups.

### Server Actions

Server Actions are the default mutation interface:

- `createListing`
- `updateListing`
- `publishListing`
- `submitApplication`
- `withdrawApplication`
- `updateApplicationStatus`
- `createInquiryConversation`
- `sendMessage`
- `proposeViewingSlots`
- `bookViewingSlot`

Every Server Action must:

- Read the current authenticated user server-side.
- Validate input with Zod.
- Enforce role and ownership before mutation.
- Delegate atomic business rules to Postgres RPCs.
- Return typed success/error results for UI handling.
- Revalidate affected paths or tags after successful mutation.

### Route Handlers

Use route handlers for:

- Public viewport listing query: `GET /api/listings`.
- Signed document access: `GET /api/documents/[id]/signed-url`.
- Notification digest cron: `POST /api/cron/notifications/digest`.
- Optional notification retry endpoint: `POST /api/notifications/retry`.

## 7. Database Architecture

### Extensions

Enable:

- `pgcrypto` for UUID generation if needed.
- `postgis` for spatial listing queries.

### Core Tables

#### `profiles`

Stores application-level user data linked to Supabase Auth.

Key fields:

- `id uuid primary key references auth.users(id)`
- `role user_role not null`
- `email text not null`
- `phone text`
- `phone_verified boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

#### `listings`

Stores landlord-owned listings.

Key fields:

- `id uuid primary key`
- `landlord_id uuid not null references profiles(id)`
- `title text not null`
- `price integer not null`
- `address text not null`
- `latitude numeric(9,6) not null`
- `longitude numeric(9,6) not null`
- `location geometry(Point, 4326) generated always as (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) stored`
- `bedrooms numeric(3,1) not null`
- `bathrooms numeric(3,1) not null`
- `parking_type text not null`
- `parking_count integer not null default 0`
- `electricity_type text not null`
- `water_availability text not null`
- `lease_duration text not null`
- `availability_date date not null`
- `metadata jsonb not null default '{}'::jsonb`
- `status listing_status not null default 'draft'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `listings_landlord_id_idx`
- `listings_status_idx`
- `listings_location_gix` using GiST on `location`
- `listings_status_price_idx`

#### `listing_images`

Stores ordered listing media.

Key fields:

- `id uuid primary key`
- `listing_id uuid not null references listings(id) on delete cascade`
- `bucket text not null default 'listing-images'`
- `path text not null`
- `public_url text not null`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

Constraints:

- Unique `(listing_id, sort_order)`.
- Publish validation checks at least 3 images.

#### `applications`

Stores structured renter applications.

Key fields:

- `id uuid primary key`
- `listing_id uuid not null references listings(id)`
- `renter_id uuid not null references profiles(id)`
- `status application_status not null default 'submitted'`
- `full_name text not null`
- `income integer not null`
- `employment_status text not null`
- `move_in_date date not null`
- `household_size integer not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `applications_listing_id_idx`
- `applications_renter_id_idx`
- Partial unique index on `(listing_id, renter_id)` where status is active.
- Partial index on `(renter_id, status)` where status is active.

#### `documents`

Stores private application document references.

Key fields:

- `id uuid primary key`
- `application_id uuid not null references applications(id) on delete cascade`
- `type document_type not null`
- `bucket text not null default 'application-documents'`
- `path text not null`
- `file_name text not null`
- `mime_type text`
- `byte_size integer`
- `uploaded_by uuid not null references profiles(id)`
- `created_at timestamptz not null default now()`

Constraints:

- Unique `(application_id, type)`.
- Required document types for submission: `id`, `payslip`.

#### `conversations`

Stores scoped listing conversations.

Key fields:

- `id uuid primary key`
- `listing_id uuid not null references listings(id)`
- `renter_id uuid not null references profiles(id)`
- `landlord_id uuid not null references profiles(id)`
- `application_id uuid references applications(id)`
- `type conversation_type not null`
- `created_at timestamptz not null default now()`

Constraints:

- Inquiry conversations require `application_id is null`.
- Application conversations require `application_id is not null`.
- Unique active conversation per `(listing_id, renter_id, type, application_id)`.

#### `messages`

Stores chat messages.

Key fields:

- `id uuid primary key`
- `conversation_id uuid not null references conversations(id) on delete cascade`
- `sender_id uuid not null references profiles(id)`
- `listing_id uuid not null references listings(id)`
- `content text not null`
- `created_at timestamptz not null default now()`

Constraints:

- `content` length capped for MVP.
- No file attachment fields in MVP.

#### `viewing_slots`

Stores proposed time windows.

Key fields:

- `id uuid primary key`
- `listing_id uuid not null references listings(id)`
- `created_by uuid not null references profiles(id)`
- `start_time timestamptz not null`
- `end_time timestamptz not null`
- `is_booked boolean not null default false`
- `created_at timestamptz not null default now()`

Constraints:

- `end_time > start_time`.

#### `viewing_slot_offers`

Links viewing slots to shortlisted applications.

Key fields:

- `id uuid primary key`
- `slot_id uuid not null references viewing_slots(id) on delete cascade`
- `application_id uuid not null references applications(id) on delete cascade`
- `created_at timestamptz not null default now()`

Constraints:

- Unique `(slot_id, application_id)`.

#### `viewings`

Stores confirmed bookings.

Key fields:

- `id uuid primary key`
- `application_id uuid not null references applications(id)`
- `slot_id uuid not null references viewing_slots(id)`
- `status viewing_status not null default 'booked'`
- `created_at timestamptz not null default now()`

Constraints:

- Unique `(slot_id)`.
- Unique active viewing per application for MVP.

#### `notification_events`

Stores notification outbox events.

Key fields:

- `id uuid primary key`
- `recipient_id uuid not null references profiles(id)`
- `type notification_type not null`
- `payload jsonb not null`
- `sent_at timestamptz`
- `digest_at timestamptz`
- `failed_at timestamptz`
- `failure_reason text`
- `created_at timestamptz not null default now()`

#### `analytics_events`

Stores MVP funnel metrics.

Key fields:

- `id uuid primary key`
- `user_id uuid references profiles(id)`
- `event_name text not null`
- `properties jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

## 8. Enums

```sql
create type user_role as enum ('renter', 'landlord');
create type listing_status as enum ('draft', 'published', 'archived');
create type application_status as enum (
  'submitted',
  'under_review',
  'shortlisted',
  'rejected',
  'approved',
  'withdrawn'
);
create type document_type as enum ('id', 'payslip');
create type conversation_type as enum ('inquiry', 'application');
create type viewing_status as enum ('booked', 'cancelled', 'completed');
create type notification_type as enum (
  'new_application',
  'new_message',
  'viewing_proposed',
  'viewing_booked'
);
```

Active application statuses:

```sql
('submitted', 'under_review', 'shortlisted', 'approved')
```

## 9. RLS Architecture

RLS is a core safety boundary, not a cosmetic layer. Service-role access must be rare and server-only.

### Policy Summary

| Table | Renter access | Landlord access | Public access |
| --- | --- | --- | --- |
| `profiles` | Own profile only | Own profile only | None |
| `listings` | Read published | Own listing CRUD | Read published |
| `listing_images` | Read images for published listings | CRUD images for own listings | Read images for published listings |
| `applications` | Own applications | Applications for own listings | None |
| `documents` | Own application docs metadata | Docs metadata for own listing applications | None |
| `conversations` | Conversations where participant | Conversations where participant | None |
| `messages` | Messages in own conversations | Messages in own conversations | None |
| `viewing_slots` | Offered slots for own applications | Slots for own listings | None |
| `viewings` | Own application viewings | Viewings for own listing applications | None |
| `notification_events` | Own notifications | Own notifications | None |
| `analytics_events` | Insert own events | Insert own events | None |

### Storage Policies

Buckets:

- `listing-images`: public read, restricted write by listing owner.
- `application-documents`: private read/write.

Application document paths:

```text
{renter_id}/{listing_id}/{document_type}-{uuid}.{ext}
```

Rules:

- Renters can upload only into their own `renter_id` folder.
- Renters cannot directly read raw documents after upload unless authorized by RLS.
- Landlords do not read storage paths directly from the browser.
- Landlord document access goes through `GET /api/documents/[id]/signed-url`, which checks ownership and returns a short-lived signed URL.

## 10. Critical Business Flows

### Map Discovery

```text
Renter opens /
  -> MapView initializes Mapbox
  -> Map movement produces debounced bbox
  -> GET /api/listings?bbox=...
  -> Postgres RPC get_published_listings_in_bbox
  -> Return minimal listing pin payload
  -> Map renders price pins
  -> Renter clicks pin
  -> Listing detail fetched
  -> ListingPanel opens while map remains visible
```

Pin payload:

```ts
type ListingPin = {
  id: string;
  price: number;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  thumbnailUrl: string | null;
};
```

### Listing Creation

```text
Landlord opens /dashboard/listings/new
  -> Server verifies landlord role
  -> Client form captures structured fields
  -> Mapbox Search finds address/coordinates
  -> Landlord uploads images to listing-images bucket
  -> createListing/updateListing stores draft
  -> publishListing validates required fields and 3 images
  -> Listing status becomes published
```

### Application Submission

```text
Renter clicks Apply Now
  -> Server checks auth, role, email verification, phone verification
  -> Client uploads ID and payslip to private storage path
  -> submitApplication Server Action validates form and document references
  -> Postgres RPC locks renter profile row
  -> RPC counts active applications
  -> If active count >= 5, reject
  -> RPC checks duplicate active application for listing
  -> RPC creates application and document rows
  -> Notification event created for landlord
  -> UI revalidates applications and listing state
```

The application cap must live in a transaction-backed RPC. UI-only cap checks are allowed for user feedback but never trusted.

### Applicant Review

```text
Landlord opens listing applicant queue
  -> Server reads applications for owned listing
  -> ApplicantCard shows structured data and document status
  -> Landlord selects Shortlist/Reject/Approve
  -> updateApplicationStatus validates landlord owns listing
  -> Status changes and optional notification event is created
```

### Chat

```text
Renter clicks Message
  -> Server verifies logged-in renter with verified phone/email
  -> createInquiryConversation creates or returns conversation
  -> ChatBox subscribes to conversation channel
  -> sendMessage Server Action validates membership
  -> Message row inserted
  -> Notification event created for recipient
```

Realtime strategy:

- MVP source of truth is the `messages` table.
- Realtime subscriptions are an enhancement for live updates.
- Private channel authorization must be configured before production chat is enabled.
- If realtime fails, the message list can refetch on send/focus.

### Viewing Scheduling

```text
Landlord shortlists applicant
  -> Landlord clicks Propose Viewing
  -> CalendarScheduler creates one or more slots
  -> proposeViewingSlots validates listing ownership and shortlisted status
  -> Slots and slot offers are created
  -> Renter receives viewing_proposed notification
  -> Renter selects a slot
  -> bookViewingSlot validates slot offer and renter ownership
  -> RPC updates viewing_slots where is_booked=false
  -> RPC creates viewing
  -> Landlord receives viewing_booked notification
```

Slot booking must use one atomic operation:

```sql
update viewing_slots
set is_booked = true
where id = target_slot_id
  and is_booked = false
returning id;
```

If no row returns, the slot is already booked and the booking is rejected.

## 11. Notification Architecture

Use an outbox table plus Resend sender code.

### Immediate Notifications

Event-producing actions insert `notification_events`:

- New application -> landlord.
- New message -> recipient.
- Viewing proposed -> renter.
- Viewing booked -> landlord.

After the transaction succeeds:

- Server action or route handler attempts immediate send through Resend.
- On success, set `sent_at`.
- On failure, set `failed_at` and `failure_reason`, leaving it eligible for retry/digest.

### Digest Fallback

Vercel Cron calls:

```text
POST /api/cron/notifications/digest
```

The digest job:

- Finds unsent or unread notification events older than the immediate-send window.
- Groups by recipient.
- Sends a compact digest email.
- Sets `digest_at`.

## 12. Security Boundaries

### Never Expose

- Supabase service role key.
- Resend API key.
- Private document bucket paths as direct downloadable URLs.
- Raw document URLs without authorization checks.

### Server-Only Modules

- `src/lib/supabase/admin.ts`
- `src/features/notifications/send.ts`
- `src/features/documents/signed-urls.ts`
- Any function that uses `SUPABASE_SERVICE_ROLE_KEY`

### Authorization Rules

- Server Actions are treated like public API endpoints: every action must verify auth, role, and ownership.
- RLS must still protect every table even when server actions already check ownership.
- All document access is relation-based: renter owns application or landlord owns listing tied to application.
- Realtime channels must be private before chat is considered production-ready.

## 13. Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_MAPBOX_TOKEN=

RESEND_API_KEY=
RESEND_FROM_EMAIL=

CRON_SECRET=
NEXT_PUBLIC_APP_URL=
```

Rules:

- Only `NEXT_PUBLIC_*` values can be used in browser code.
- Service role key, Resend key, and cron secret are server-only.
- `CRON_SECRET` must be required by cron route handlers.

## 14. Observability And Analytics

MVP analytics events:

- `listing_viewed`
- `listing_panel_opened`
- `application_started`
- `application_submitted`
- `application_blocked_cap`
- `application_withdrawn`
- `application_shortlisted`
- `viewing_slots_proposed`
- `viewing_booked`
- `message_sent`

Operational logs:

- Notification send failures.
- Document signed URL authorization failures.
- Application cap rejections.
- Slot booking conflicts.
- Map listing query errors.

Success metrics:

- At least 60% of listings receive at least 1 application.
- At least 30% of applications are shortlisted.
- At least 20% of shortlisted applications reach viewing scheduled.

## 15. Testing Architecture

### Unit Tests

- Zod validators.
- Listing publish requirements.
- Amenities metadata parsing.
- Application active status calculation.
- Notification payload builders.

### Database Tests

- RLS policies per role.
- Listing viewport RPC.
- Application cap RPC.
- Duplicate active application protection.
- Withdrawal freeing cap slot.
- Slot booking concurrency.
- Document metadata access rules.

### E2E Tests

- Renter discovers listing on map and opens listing panel.
- Renter applies with required documents.
- Renter is blocked at 5 active applications.
- Landlord shortlists applicant.
- Renter and landlord chat.
- Landlord proposes viewing slots.
- Renter books a slot.
- Notification event is created for landlord.

### Responsive Tests

- Desktop map plus right-side panel.
- Mobile map plus 60-70% bottom sheet.
- CTA visibility and text fit.
- Map does not disappear during listing evaluation.

## 16. Build Order

The architecture supports this build sequence:

1. CHE-14: Scaffold Next.js app.
2. CHE-15: Supabase clients, auth routes, and profile creation.
3. CHE-16: Role-based access.
4. CHE-17: RLS baseline and storage buckets.
5. Database migrations for core schema and RPCs.
6. CHE-18 through CHE-21: Map discovery.
7. CHE-22 through CHE-25: Listing management.
8. CHE-26 through CHE-29: Listing panel UX.
9. CHE-30 through CHE-33: Applications and documents.
10. CHE-34 through CHE-37: Landlord review and chat.
11. CHE-38 through CHE-41: Viewing scheduling and notifications.

## 17. Architecture Decisions To Preserve

- Do not let the browser perform critical business mutations directly.
- Do not implement the application cap only in React or server action code; use a transaction-backed RPC.
- Do not expose application documents through public URLs.
- Do not let chat exist outside a listing context.
- Do not build payments, reviews, AI scoring, or advanced verification in MVP.
- Do not hide the map during the discovery/evaluation loop.

## 18. References

- Next.js App Router: https://nextjs.org/docs/app
- Next.js Server Actions and Mutations: https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations
- Supabase Auth with Next.js: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase Storage Buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Mapbox Search JS Geocoding: https://docs.mapbox.com/mapbox-search-js/api/core/geocoding/
- Resend with Next.js: https://resend.com/nextjs
