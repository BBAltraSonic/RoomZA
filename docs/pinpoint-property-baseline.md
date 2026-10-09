# Pinpoint Property baseline

Recorded 28 September 2026. Scope: the current uncommitted checkout and the local Supabase project at `127.0.0.1:54321`. Counts are a point-in-time snapshot, not production supply. Read-only database queries were used; browser visits to listing detail can add `listing_viewed` analytics events.

## Evidence boundaries

| Environment | What was checked | Limit |
| --- | --- | --- |
| Local | Current working tree, local Supabase reads, and Chromium at 1440 × 900 and 390 × 844 against Next.js on `localhost:3000`. The continuation below adds seeded test-account checks. | `.env.local` has no MapTiler key and the place catalogue is empty. Test credentials were unavailable at the initial audit; seeded `.test` accounts were found during continuation. |
| Staging | No staging URL, database connection, or test accounts were available for this audit. | Migration, inventory, journeys, RLS, and analytics are unverified there. |
| Production | No production site or database was inspected. | Do not infer live inventory, migration state, journeys, or analytics from local data or `.env.production.local`. |
| Code only | Routes, queries, publishing validation, URL logic, and focused tests were inspected. | A code path or mocked test is not a completed customer journey. |

The `discovery_places` table exists locally and returned **0 rows**. The plan records earlier local-only validation of its coordinate checks, grants/RLS, and service-role upsert; those checks were not repeated here. Staging and production application of `supabase/migrations/20260927090000_pinpoint_places.sql` remain unverified. No local place was inserted to manufacture a Feed result.

## Property routes and links

| Route or state | Current contract and evidence |
| --- | --- |
| `/` | Map-first Property discovery; `mode=buy` changes market, with rent as the default. Local map reports that MapTiler is not configured. |
| `/?view=feed&area=...&areaId=<UUID>` | Stored-place Feed queries `/api/listings` by `areaId` without map bounds. `area` remains display text. No live selectable place existed for this audit. |
| `/?listingId=<UUID>` | Property detail overlay link. Code preserves `listingId`, `mode`, filters, and selected place on Feed/Map view changes; focused tests cover this. A direct Feed link without an area initially failed locally, then passed on both viewports after the repair below. |
| `/listings` and `/listings?mode=buy` | Public list pages. Both rendered locally on phone and desktop; the buy page showed an empty result. The page query caps cards at 60, so its visible total is not inventory. |
| `/listing/<UUID>` | Published Property detail. The tested rental rendered on both viewports despite missing map configuration. `?intent=message` is accepted by the route. |
| `/saved`, `/messages`, `/applications` | Protected customer workspaces. Anonymous visits redirected to `/auth?redirect=%2F...` on both viewports. Sign-in return after successful authentication was not tested. |
| `/dashboard`, `/dashboard/buyers`, `/dashboard/listings/[id]/applicants`, `/dashboard/viewings` | Provider and buyer follow-up surfaces exist in code; access and response flow require suitable accounts. |

Code-only URL checks cover legacy geocoder IDs being resolved to app-owned UUIDs, retained buy filters and `listingId`, and stale place-response rejection. The local catalogue was empty, so live legacy-link resolution was not repeated. Saved homes use `user_favorites` and link back through `/?listingId=<UUID>`; no schema or saved-home data was changed.

## Local inventory

The local `listings` table returned **300 rows**, all `rent/published`; it returned **0 sale listings of any status**. All 300 had coordinates and belonged to 25 distinct `landlord_id` values. The area below is parsed from the last two comma-separated segments of each listing address, not from a canonical place ID. Every count in this table is a published rental; sale count is zero in every area.

| City | Rentals | Areas and rental counts |
| --- | ---: | --- |
| Johannesburg | 60 | Sandton 11; Rosebank 9; Fourways 7; Randburg 6; Bryanston 5; Bedfordview 5; Parktown 5; Braamfontein 5; Midrand 4; Melville 3 |
| Cape Town | 60 | Sea Point 14; Century City 9; Observatory 8; Bellville 6; Rondebosch 5; Woodstock 5; Milnerton 4; Green Point 4; Claremont 3; Gardens 2 |
| Pretoria | 35 | Menlyn 8; Lynnwood 7; Brooklyn 6; Sunnyside 5; Arcadia 4; Hatfield 3; Centurion 2 |
| Durban | 35 | Morningside 8; Durban North 8; Glenwood 6; Westville 6; Umhlanga 4; Berea 3 |
| Gqeberha | 20 | Summerstrand 7; Richmond Hill 4; Lorraine 4; Walmer 3; Humewood 1; Newton Park 1 |
| Bloemfontein | 15 | Westdene 7; Dan Pienaar 6; Universitas 2 |
| East London | 15 | Beacon Bay 7; Gonubie 4; Nahoon 4 |
| Mbombela | 15 | Sonheuwel 5; Steiltes 5; Nelspruit Central 5 |
| Polokwane | 15 | Bendor 6; Flora Park 5; Penina Park 4 |
| Kimberley | 10 | Monument Heights 6; Royldene 4 |
| Rustenburg | 10 | Safari Gardens 6; Cashan 4 |
| George | 10 | Heatherlands 5; Blanco 5 |
| **Total** | **300** | **60 address-derived areas** |

## Publication and analytics

**Code-only publication rule:** the publish action checks owner or managed-organization access, validates the listing against `listingSchema`, requires at least `MIN_LISTING_IMAGES` photos, then sets `status='published'`. Public list, viewport, detail, and sitemap queries require `status='published'`; rent/buy queries also filter `listing_type` (`rent` or `sale`). Direct detail API requests may enforce `mode`. A published listing can be unpublished through its separate action. These rules were inspected in `src/features/listings/actions.ts`, `publish-validation.ts`, `api.ts`, and the public routes; a publish/unpublish transaction was not exercised.

**Local analytics availability:** before browser detail visits, `analytics_events` had 75 rows: `listing_viewed` 20, `listing_saved` 19, `search_filter_applied` 20, and `map_marker_clicked` 16. The observed event timestamps spanned 30 June to 28 September 2026. These are local event records, not a conversion funnel or production metric. The local database also had 75 profiles, 100 `user_favorites`, 100 applications, 25 viewings, 40 conversations, 228 messages, and 0 buyer interests or purchase-progress rows. Row counts alone do not prove a usable test persona or successful workflow.

## Journey checks and blockers

| Check | Local result | What is needed to finish |
| --- | --- | --- |
| Rental discovery → detail | `/listings` and one published `/listing/<UUID>` rendered at desktop and phone sizes. The detail showed rental price and action controls. | A configured map/place search or an existing stored place to test the new Feed and map discovery end to end. |
| Rental message/viewing | `Connect now` opened the connection and showing choices on both sizes. `/messages` preserved its anonymous sign-in return path. | Renter and provider test credentials, a reachable provider or scheduled viewing fixture, and permission to submit non-disruptive test interactions. No message or viewing was sent. |
| Rental application/provider response | `Apply now` showed “Sign in required” on both sizes; `/applications` preserved its return path. | Renter and provider test credentials, a suitable listing, and controlled application/response test data. No application was submitted. |
| Saved homes | `/saved` preserved `/saved` in the anonymous sign-in redirect on both sizes. | Renter test credentials to verify save, persistence, and return to the property. Existing favorites were not modified. |
| Purchase | `/listings?mode=buy` rendered an empty sale state on both sizes. In the Feed, clicking Buy and Rent on both sizes retained `view=feed&beds=2` while adding or removing `mode=buy`. No sale detail was available. | At least one suitable published sale listing, buyer/provider test accounts, and controlled buyer-interest/follow-up data. **An empty buy Feed is not a completed sale journey.** |
| Legacy links, `listingId`, filters, back navigation | Mocked tests cover legacy ID normalization and URL retention. After repair, a local direct rental Feed URL with `mode=rent`, `beds=2`, and `listingId` opened detail on desktop and phone; Back to homes removed only `listingId` and retained view, mode, and beds. | A stored legacy place and live geocoder configuration for the old-provider-ID path; sale data for buy-link behavior. |

### Known defects and triage

1. **Property link regression, repaired locally:** a direct `/?view=feed&mode=rent&listingId=<published rental UUID>&beds=2` kept its URL but initially showed only “Choose a South African place.” The 2-second detail timeout repeatedly aborted the local API call. The detail-link effect now attempts each URL once, allows 12 seconds for the detail request, and shows a retry action on failure. Retest opened the detail from that URL on both viewports and returned to the filtered Feed without losing `view`, `mode`, or `beds`. Staging and production remain unverified.
2. **Local configuration gap:** no `NEXT_PUBLIC_MAPTILER_API_KEY` in `.env.local`; the map says it is not configured and live geocoder suggestions cannot be verified. A key in `.env.production.local` is not evidence for local, staging, or production behavior.
3. **Sale-data gap:** zero local sale rows, so buyer interest and provider follow-up cannot be exercised. The empty buy list is an accurate result, not a sale-journey pass.
4. **Separate existing quality-gate failure:** the full type check again reported unsupported `workerPath` options in `scripts/ops/check-cloudflare-worker-size.test.ts` at lines 30, 39, and 48. The local browser also logged existing Next Image loader-width warnings for listing images.

## Continuation: authenticated journeys and Step 1.4 read-only audit

These are additional **local** checks on 28 September 2026, against the same uncommitted checkout. The seeded `@roomza.test` credentials in `supabase/seed.sql` worked. Browser checks used desktop 1440 × 900 and phone 390 × 844. No message, application, viewing, buyer interest, provider status change, or favorite was created or removed. Signing in and opening listing detail can update session and analytics records.

| Journey check | Completed local evidence | Still needed |
| --- | --- | --- |
| Sign-in return | Seeded renter sign-in returned to `/saved` and `/applications`; seeded landlord sign-in returned to `/dashboard` on both sizes. | Repeat in staging with isolated test accounts. |
| Saved homes | Renter02's two existing saved homes remained after reload on both sizes. A saved card opened its `/?listingId=<UUID>` link; browser Back returned to `/saved`. | Exercise a new save/remove transaction with controlled test data and verify persistence in staging. |
| Messages, viewing, application, provider queue | Renter02's existing conversation and application rendered on both sizes; the application showed a booked viewing. Landlord23 could read the same conversation and the matching applicant queue for the published Sea Point rental, including the renter and booked viewing. | Exercise new renter messages, viewing request/booking, application submission and provider response with an isolated fixture and notification side effects controlled. Existing records prove read access and rendering, not creation or response. |
| Rental and purchase URLs | Direct rental Feed and Map `mode=rent&beds=2&listingId=<UUID>` links opened on both sizes; Back to homes removed only `listingId`. The empty `view=feed&mode=buy&beds=2` retained its filters, switching to Rent removed `mode=buy`, and Map → Feed → Map retained `mode=buy&beds=2`. `/listings?mode=buy` remained empty. | A stored place and local MapTiler key for live place switching and legacy provider-ID normalization; a published sale listing for purchase filters, sale detail and buyer actions. |
| Legacy place URL | `areaId=neighbourhood.rondebosch&mode=buy&beds=2` retained its URL and showed an unresolved-place state on both sizes. | Store a matching place through a configured geocoder in local or staging and verify normalization to the app UUID. The unresolved state is not proof of successful legacy-link resolution. |

The final phone pass exposed a Feed navigation defect: the fixed account avatar intercepted taps on the Map button. The button was moved below the avatar into the Rent/Buy control row in `discovery-page.tsx`. A normal Playwright tap then switched Feed → Map on both phone and desktop while retaining `mode=buy&beds=2`; Map direct-link detail and Back to homes were also rechecked on both sizes. This is a local fix only; staging and production are unverified.

**Local data and ownership:** Read-only service-role queries confirmed 300 published rentals, zero sale rows of any status, zero `discovery_places`, zero buyer interests, 75 profiles, 100 applications, 25 viewings, 40 conversations, 100 favorites, 2,104 listing-image rows, and zero purchase-progress rows. The 300 listings belong to 25 distinct profiles. Across these local rows, no listing owner, application listing/renter, viewing application, conversation listing/participant, or favorite listing/owner reference was missing. These checks establish links in this seed only; they do not test authorization boundaries. The expected `discovery_places` columns are queryable locally, but migration history and the live policies were not compared to the SQL files.

| Step 1.4 surface | Local evidence | Code-only evidence and remaining prerequisite |
| --- | --- | --- |
| RLS and migration | The place table and expected columns are queryable. Local SQL migration history and `pg_policies` were not available through the read-only REST queries. Port 54322 is reachable, but no SQL client is installed in this workspace. | The Pinpoint migration declares public select, service-role select/insert and RLS; the Property, buyer-interest, application, and organization migrations define owner/persona policies. A SQL client or usable local Supabase CLI/Docker access is needed to compare applied migrations and policies. `supabase status` failed because the CLI tried to write telemetry outside the workspace; Docker API access was denied in this sandbox. |
| Storage | Six buckets exist locally; `listing-images`, `blog-media` are public, while `application-documents`, `privacy-exports`, `listing-imports`, and `profile-documents` are private. `storage.objects` and public `documents` both have zero rows; `listing_images` has 2,104 metadata rows. | Storage policies for listing images, applications, imports and profile documents are in migrations. No private document object or signed URL was available for a live access check. |
| Organizations | Zero organizations, memberships, invitations, and organization-linked listings locally. | The organization migration defines membership roles and RLS, but an organization/member fixture is needed to exercise it. |
| Jobs and environments | Local `.env.local` points to local Supabase; it has no MapTiler key. No staging URL/database/test accounts were configured for this audit. No production environment was queried. | Repo code has QStash-backed job routes for notifications, imports, privacy exports and live tours, plus SQL cron jobs for document expiry and other reminders. Runtime schedules, delivery and secrets require environment-specific inspection. `.env.production.local` was not used to fill local gaps. |
| Restore and rollback | No restore or rollback was performed. | `docs/operations/backup-restore-runbook.md` specifies Postgres, private document and Terraform/Vercel metadata backups, plus an isolated-staging restore drill and target recovery times. It does not record a completed drill or a Pinpoint migration rollback procedure; these need a staging exercise and an approved corrective migration plan before release. |

**Staging:** no URL, database connection, or test accounts were available, so migration parity, row counts, RLS, storage, jobs and the full journeys remain unverified there. **Production:** no site or database was accessed; all inventory and behavior above are local only. **Code-only:** policies, URL tests and job definitions describe intended behavior and do not establish deployed behavior.

Step 1.1 remains the completed baseline. Steps 1.2, 1.3 and 1.4 remain open: authenticated rental display and return paths were checked, while new interactions, sale actions, direct SQL access review, and staging validation still need their stated prerequisites. An empty buy Feed is not a completed purchase journey.

## Direct SQL follow-up: local migration and access evidence

On 28 September, read-only `psql` queries through the **local** `supabase_db_roomza` container resolved the earlier SQL-access gap. No migration, fixture, notification, or other data change was made. This section supersedes only the earlier statement that local migration history and live policies could not be inspected; it does not turn the local checks into staging or production evidence.

| Surface | Verified local result | Limit or next prerequisite |
| --- | --- | --- |
| Migration history | The 68 version numbers in `supabase_migrations.schema_migrations` match all 68 repository migration filenames, including `20260927090000_pinpoint_places`. | Version parity does not prove every object is identical to the SQL source or that staging and production have applied it. Obtain read-only access to each target before release. |
| Place schema and access | `discovery_places` has RLS enabled; its level, coordinate, bounds, centre-within-bounds, unique provider ID, and lowercase-name index are present. The live policy permits `SELECT` to `anon` and `authenticated`. Catalog grants permit their reads, deny their inserts, and permit service-role inserts. The table still has zero rows. | An empty catalogue cannot exercise place-specific Feed results or prove that a stored legacy provider ID resolves. A local/staging MapTiler key and a legitimate stored place are required. |
| Property RLS | The active-account policies on `listings`, `applications`, `buyer_interests`, and related tables are **restrictive**. In read-only role simulations, renter02 saw exactly their 4 applications and 2 favorites; landlord23 saw exactly the 3 applications on their listings and no other user's favorites. These counts matched owner-filtered SQL. Anonymous access saw the 300 published listings. | This checks selected seeded identities and reads only. It does not exercise writes, suspended accounts, buyer/seller roles, organizations, or private documents. |
| Storage and organizations | The six bucket visibility flags match the earlier REST inventory: `listing-images` and `blog-media` public, four other buckets private. There are still zero `storage.objects`, public `documents`, organizations, memberships, and invitations. Live `storage.objects` policies include renter/landlord document and profile-owner scopes; membership policies limit reads to members or managers. | With no private object or organization member fixture, signed-URL behavior and organization isolation remain untested. |
| Jobs | `cron.job` contains three active local schedules: profile-document expiry reminders, landlord trust-metric refresh, and stale presence sweep, matching migration-defined jobs. `vercel.json` defines a separate notification digest schedule; app routes also define QStash-backed work. | Database schedule presence does not prove delivery. Vercel/QStash schedules and notification sinks require environment-specific inspection. |

**Fixture decision:** The next renter message, viewing, application, provider response, sale, buyer interest, private-document and organization access tests all need new isolated accounts or records. Notification and job effects were not shown to be contained, so no fixture was created and no existing record was changed. The smallest safe journey prerequisite is an isolated rental listing plus renter/provider test accounts with email, QStash, push and scheduled notifications directed to a test sink, followed by a cleanup plan for only those fixture IDs. A separate published sale listing and buyer/seller accounts are required for Step 1.3.

**Staging:** No staging URL, database access, isolated personas, storage fixture, or job dashboard was available in this session. **Production:** No production system or secret was used. **Code only:** `vercel.json`, QStash routes, migrations, and the restore runbook describe intended behavior. The restore drill is not recorded as completed; the runbook now includes a data-preserving Pinpoint correction path. Steps 1.2, 1.3, and 1.4 remain unchecked.

## Read-only chat and viewing access follow-up

On 28 September, additional **local-only** SQL checks used `BEGIN READ ONLY` and `SET LOCAL ROLE authenticated` with seeded test identities. They compared visible rows with independent owner/participant joins run by the local database administrator. The columns below are conversations, messages, viewings, viewing slots, and application status events, in that order. No row or fixture was changed.

| Seeded identity | RLS-visible counts | Owner/participant-joined counts |
| --- | --- | --- |
| renter02 | 2 / 14 / 1 / 1 / 4 | 2 / 14 / 1 / 1 / 4 |
| landlord23 | 2 / 12 / 2 / 2 / 3 | 2 / 12 / 2 / 2 / 3 |
| renter03 (unrelated to these records) | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| landlord24 | 2 / 16 / 1 / 1 / 3 | 2 / 16 / 1 / 1 / 3 |

The local tables held 40 conversations, 228 messages, 25 viewings, 25 viewing slots, and 100 application status events. `notification_events` held zero rows, and each simulated identity saw zero. An anonymous role could not read `conversations` because the table has no `SELECT` grant to `anon`; the transaction stopped at that permission error, so anonymous access to the other tables was not asserted by this query. These checks cover selected read policies and seeded identities only. They do not prove write authorization, blocked-account behavior, notification delivery, or staging/production access.

**Rental write prerequisite:** The current message, viewing-proposal/booking, application-submission, and application-status actions insert notification events and enqueue their IDs. The local notification worker can send through Resend; `.env.local` defines `RESEND_API_KEY`. No `QSTASH_TOKEN` is defined in that file, but a later digest or another process could still deliver stored events. The repository's notification digest has a scheduled route, and push delivery was not verified as isolated. Before creating a local journey fixture, run a dedicated local app and database with disposable renter/provider accounts and rental listing, verified test-only email destination, QStash and push disabled or redirected to test sinks, and notification schedules stopped or redirected. Record fixture IDs and clean up only those IDs after the journey. None of those controls was established in this pass, so no message, viewing, application, provider response, or fixture was created. Steps 1.2–1.4 remain open.

## Isolated local rental journey follow-up

Later on 28 September, the **local** app ran on port 3100 with email, QStash, Redis and cron credentials explicitly cleared and `NEXT_PUBLIC_APP_URL` set to localhost. The env parser was adjusted so empty optional overrides mean unset. No local dev server was running before this one; the three active database cron jobs do not deliver notification digests. The test created only three disposable `@roomza.test` accounts, one synthetic published rental and three fixture image references. All 33 external notification subscriptions for the fixture accounts were disabled. No document was uploaded and no poster was contacted.

| Journey | Desktop 1440 × 900 | Phone 390 × 844 |
| --- | --- | --- |
| Listing and sign-in return | The synthetic rental detail opened; a fresh renter sign-in returned to it. | The detail opened and the second renter's sign-in returned to it. |
| New message | Renter message persisted in SQL and rendered in the conversation. | Renter message and provider reply persisted in SQL; the renter saw the reply after a fresh load. |
| Application | Renter submitted a new application without documents; the provider queue showed the applicant. | Second renter submitted a new application; the provider queue showed that applicant. |
| Viewing and provider response | Provider shortlisted, proposed an October slot and approved; renter booked the slot. SQL showed an approved application and booked viewing. | Provider shortlisted, proposed a separate October slot and approved; renter booked the slot and saw Approved after reload. |

The first desktop message exposed a real notification bug: the sender inserted a recipient event with a user-scoped client and requested its ID, but recipient-only `SELECT` RLS rolled back the insert. Rental message, application, status and viewing actions now record notification events through a server-only service-role helper **after** their existing actor/ownership checks. A retest persisted the notification. The phone viewing dialog also sat below the fixed landlord navigation (`z-50` versus `z-60`), which intercepted Send proposal; the dialog now uses a higher layer and the normal phone tap passed. These are local code changes; staging and production were not tested.

The completed fixture produced 13 notification events, all with `sent_at` empty. QStash publishing was skipped by the isolated app process and external subscriptions were disabled. The initial phone chat script closed on an optimistic message before its server action finished; that was corrected by waiting and checking SQL, rather than counting the optimistic bubble as a pass. Cleanup deleted only the guarded fixture accounts, listing, conversations, analytics and notification rows. Post-cleanup counts returned to 75 auth users/profiles, 300 listings, 2,104 listing images, 100 applications, 25 viewings, 40 conversations, 228 messages and zero notification events. No fixture account, listing or listing analytics remained. The test server and temporary browser session files were removed.

**Remaining limits:** This was a local fixture journey, not a stored-place Feed/Map or staging test. The catalogue remains empty, MapTiler is absent locally, and no sale listing was created. Notification delivery itself was intentionally suppressed. At this 28 September snapshot, the live `notification_events` INSERT policy checked only that `auth.uid()` was non-null; its broad authenticated insert permission needs a separate access-policy correction after all notification writers are routed through authorized server code. Steps 1.2–1.4 remain open for the full discovery, sale, access and environment checks.

## Continuation: B1 local access correction — 30 September 2026

Calls and instant showings now persist recipient events through the server-only outbox after authorized RPCs. Migration `20260930142632_notification_server_writes_only.sql` is applied locally and denies client INSERT while preserving recipient reads and server writes. Real local actions produced eight persisted, undelivered events; denied actions/inserts produced none; retries retained event identity and delivery state. SQL and fresh recipient-session reads passed; this is API reload evidence, not a new browser journey. All public-table/auth-user counts and three cron states were restored. Full typecheck, lint (12 existing warnings), 44 focused tests, one real local scenario and diff checks passed. See [the detailed record](pinpoint-b1-local-verification.md) and [source-hashed evidence](pinpoint-b1-local-evidence.json).

B1 staging/browser/delivery checks remain open. Steps 1.2–1.4 remain unchecked for stored-place/live geocoder and staging rental evidence, sale fixtures, private storage/organization access, parity and restore work. Production was not accessed.
