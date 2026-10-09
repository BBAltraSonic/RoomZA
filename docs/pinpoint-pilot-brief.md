# Pinpoint Release 1 brief: location and publishing

Status: working brief, 27 September 2026; Shopping Offer and Tourism decisions updated 1–2 October 2026. This records the user's product direction and the implementation decisions needed next. It does not authorize a public launch or claim that these features already exist.

Implementation progress: Property discovery has a separate South Africa place selector on desktop and mobile. The current code adds a stored place catalogue with app-owned UUIDs, keeps the display label in `area`, and uses `areaId` for map-free Property Feed queries. Older geocoder IDs in Property URLs are resolved and replaced on navigation. The catalogue migration was applied and validated against **local Supabase only**; the local catalogue was empty at the 28 September baseline. Staging application and production deployment have not been verified. Cross-category navigation and Shopping Offers, Tourism and Events remain later milestones. See the [Property baseline](pinpoint-property-baseline.md) for the evidence boundary and journey blockers.

## Product direction

- The location selector covers South Africa and is shared by Shopping Offers, Tourism, Events and Property. Rondebosch in the reference is an example value, not a fixed market or hardcoded default.
- Content can be supplied gradually by location. A place with no matching entries remains selectable and shows a clear empty state.
- Posters create and maintain their own Shopping Offer, Tourism and Event entries. An admin confirms a submitted version before it becomes public. Material edits and renewals return to admin review.
- Eligible signed-in accounts can explicitly become posters (Product decision, 30 September 2026); access is independent of Property roles. The first intake implementation requires a permanent, confirmed, active account/session and current required policy acceptance. It grants no publication authority.
- Shopping Offers expire at the end of their stated duration without depending on a background job. Events stop appearing as upcoming after their end. Tourism entries use stated availability or validity dates. Posters can withdraw their own entries immediately.
- Existing Property discovery, saved homes, enquiries, viewings, applications, purchases and direct links stay intact.

## Location selector contract

| Situation | Expected behavior |
| --- | --- |
| Visitor chooses a place | Search South African places by name, show enough province/municipality context to distinguish duplicates, then retain that place while switching categories or Feed/Map. |
| No place selected | Ask the visitor to choose one; do not silently substitute Rondebosch. An explicit “Use my location” action may request permission. |
| Permission denied or unavailable | Manual place search remains fully usable. Explain the failure only beside the location action. |
| Visitor is outside South Africa | Explain the current geographic coverage and invite manual selection of a South African place. Do not turn an out-of-country position into a result area. |
| Place has no matching content | Show the selected place and category with a truthful empty state and an easy way to change either. Do not show invented counts. |
| Feed is active | Query by the selected place without waiting for a map or map bounds. |
| Map is active | Move to the selected place's bounds and query the visible area. Map movement must not silently rewrite the chosen place. |
| Category changes | Preserve the place; keep category-specific filters separately so Property rent/buy settings do not become offer/event filters. Ignore late responses from the old place or category. |
| Direct link or back/forward | Encode category and a stable place identifier in shareable state. A direct Property link with `listingId`, `mode=buy` or old filters keeps its existing meaning. |

Use one place record with a stable app identifier, display name, disambiguating region, centre and bounded search geometry. Reuse the current geocoder for suggestions where suitable, filtering and validating candidates as South African places; do not rely on a broad bounding box alone to decide country membership. Do not use a display string or temporary map position as the long-term identifier. Define the searchable place levels before implementation. “Universal” here means countrywide selection and one consistent selector across product categories, not a claim of content in every place.

Current code already passes `country=za` for forward geocoding in `src/lib/maptiler.ts`. Reverse geocoding has no country restriction, so an out-of-country device location still needs validation. The current `neighborhoods` migration seeds only four places; that table alone cannot be the countrywide selector catalogue.

## Poster and admin flow

1. **Draft:** A signed-in poster chooses Shopping Offer, Tourism or Event; adds a public location, accurate description, category-specific dates and action destination. Shopping Offers may have no image. Any future media needs a separately agreed rights check. Draft deletion is not implemented by the current intake; withdrawal preserves records and history.
2. **Submit:** Validate required fields and time ranges. Snapshot the submitted version. Show the poster “Awaiting admin confirmation” and keep it out of public queries.
3. **Review:** An authorized admin checks completeness and accuracy of the submitted information, including the public location, date/validity, terms and links. Admin approves or returns a reason for correction. Record reviewer, version and timestamp. Confirmation describes the review performed; it is not a guarantee of service or redemption.
4. **Publish:** Approved content becomes public only when its start time arrives and remains eligible only while its category-specific validity rule holds. Draft, rejected, withdrawn and expired content cannot appear as active in Feed, Map, search, counts or actionable detail views.
5. **Maintain:** The poster can correct, withdraw or submit a renewal. Withdrawal removes public actions promptly. Saving a private draft does not replace the confirmed snapshot. Submitting a material edit hides the offer until that revision is approved; rejection keeps it hidden rather than restoring an earlier approval. Admin can unpublish an inaccurate entry.
6. **End:** An offer expires automatically at `ends_at`; an event moves out of upcoming results after its end or stated booking cutoff; tourism availability follows its recorded dates. Old links explain status and disable stale actions. Preserve records and review history.

## Permissions and boundaries

| Actor | Allowed actions |
| --- | --- |
| Visitor | Read only approved, currently eligible public content; report an issue. |
| Poster | Create and manage own drafts, submit revisions, withdraw own content and see its review status. No access to another poster's drafts or to Property/admin privileges. |
| Admin | Review, approve, reject, unpublish and inspect the audit trail for new content, subject to the app's existing admin security checks. |

Poster access needs a separate capability from the current renter/landlord roles. The current `roles.ts` and `personas.ts` cover Property users, while `admin/auth.ts` already provides protected admin membership and MFA checks. Reuse those protections where appropriate, and enforce poster ownership on the server and in database policies rather than only hiding controls in the interface.

## First build slice and acceptance

Build one Shopping Offer from poster draft through admin confirmation, public discovery in a selected place, visitor action, poster correction/withdrawal and automatic expiry in staging. The same location selection must work in Property, and the Property journeys must still pass their baseline checks. Then complete equivalent Tourism and Event journeys before Release 1.

### Shopping Offer decisions recorded 30 September 2026

Owner: Product (user); recorded by Build from the answers in this session.

| Decision | Recorded answer | Implementation consequence |
| --- | --- | --- |
| Primary visitor action for the first Shopping Offer | **Get directions to the shop.** | Require the shop name, public address and point alongside the stored place ID. A directions action expresses intent; it is not proof of a visit or redemption. The directions provider/link format is still to be selected during action integration. |
| Visibility during review of a material edit | **Hide the offer until the edit is approved.** | Keep the approved and submitted snapshots separate for history, but remove public eligibility when a new revision is submitted. Rejection does not restore the old version. A fresh approved revision is required to return to public results. Withdrawal remains immediate. |
| Poster enrollment | **Eligible signed-in accounts can become posters.** | Use explicit account-owned enrollment, independently of renter/landlord roles. Recheck eligibility and revocation in the database; admins still confirm publication. |

The first bounded implementation is the server-only lifecycle model and publication-field validation, with synthetic in-memory tests. It is not wired to the app or database. [Evidence and the persistence handoff](pinpoint-offer-lifecycle-verification.md) distinguish tested rules from remaining server authentication, RLS, media, place validation, UI and staging work. No complete new-category journey is claimed.

Continuation, 30 September: [private intake persistence/access](pinpoint-offer-intake-verification.md) is implemented and locally tested, with explicit limits for simulated reviewer MFA and the local anonymous-RPC runtime crash. The original lifecycle model remains unchanged. The 1 October [private poster screen](pinpoint-offer-screen-verification.md) adds a real local cookie/browser journey. Approval/public projection remains open.

### Shopping Offer image decision — 2 October 2026

Owner: Product (user). An offer may have **no image**. The user's clarification asks for permission evidence to be decided separately; it does not waive that gate. Build's selected implementation rule is revision-specific poster authorization confirmation plus an admin check of supplied written authorization or an existing permissioned business record. Public shop information can corroborate content but does not establish the poster's authority. See [the separate contract](pinpoint-offer-publication-contract.md). No media upload or invented image is needed for the first image-free offer. Rights checks remain required before any later media capability is introduced; actual permission, operators and publication acceptance are not yet verified.

Acceptance checks for the first slice:

- Rondebosch is selectable but never required; switching to another supported place updates results in both Feed and Map.
- A Feed can load without initializing the map, and denied geolocation does not block manual selection.
- Poster A cannot read or change Poster B's draft; an ordinary poster cannot approve content.
- An admin-confirmed version is the only public version; a pending material edit cannot leak through a direct URL.
- Expired or withdrawn entries cease to be actionable at the exact boundary, including on an open page and if reminder jobs fail.
- Existing Property URLs and rent/buy behavior still work.

## Decisions still needed

### Tourism and Event availability decision — 2 October 2026

Owner: Product (user). Release 1 Tourism represents **continuing experiences with availability windows**, rather than dated promotions. No complete Tourism implementation or journey is claimed by this decision.

The user specifies continuous date ranges only for Tourism and Event availability; recurring weekly windows are not in scope. Ranges use exact start/end times in SAST, normalized to UTC instants. Availability stops at the exact end instant. Whole-date inclusive ranges are excluded. Pause/resume remains unresolved; material changes and renewals already require review.

The user selected **directions to the venue** as the primary visitor action for both Tourism and Events. Use a verified public venue/address/coordinate check before exposing directions. Submitting a material edit hides the entry until the new version is approved (2 October). Rejection does not restore a superseded version. The [first-slice contract](pinpoint-tourism-event-contract.md) records these requirements and separates the initial draft/submit/review/withdraw slice from unresolved pause/resume behavior and future public discovery/actions.

- Which place levels are searchable (for example province, city/town and suburb) and which places have the first real content. Countrywide South African coverage is decided; initial supply is separate.
- Who the initial admins and posters are, and what evidence an admin must inspect before confirming each category.
- Tourism/Event pause/resume rules and any separate Event publication cutoff still need a concrete contract; exact SAST ranges, material-edit hiding, review for renewal and venue directions are settled.
- Precise public category labels and useful subcategories, based on actual supplied content.
- Whether Feed hides the map and whether the reference's warm background replaces current `PRODUCT.md` and `DESIGN.md` rules. Resolve these before changing the design system or building the shared header.
