# Pinpoint redesign: first review set

16 October 2026. Implementation stops at the representative-screen review gate
requested in the approved plan. No deployment or database changes were made.

## Review the direction

The shared foundation now uses charcoal navigation, amber selections, warm light
surfaces, and a coordinated charcoal dark theme. The current font and Pinpoint
mark remain. Mobile navigation is Explore, Saved, Create, Messages, Profile;
focused workflows retain their working space. My listings remains in Profile.

Desktop details float over the map while results remain mounted. Mobile details
stay inside discovery, above bottom tabs and below its header. Existing URLs,
filters, publication rules, account checks, and category grouping remain intact.

Use the accompanying gallery to compare light/dark and mobile/desktop versions of
Property, Services, Shopping Specials, Places, Events, creation, and My listings.
The full application pass begins only after review of these representatives.

## Evidence boundaries

- Discovery screenshots render actual application routes in a local production
  build with intercepted sample public responses and a fixture map style. The
  dark map canvas demonstrates control, panel, and marker contrast; it does not
  demonstrate production tiles, roads, labels, or live data.
- Category workspaces and the quick-draft form render actual application
  components as static previews. Authentication is not bypassed in the app.
  These previews cannot submit or publish data. The form includes the actual
  unavailable-location-picker state, with submission disabled.
- Sample property photography is presentation content, not a production listing.
  The review does not establish real-device keyboard/touch behavior, completed
  authentication, contact delivery, applications, or publication.
- Shared tokens propagate to existing consumers. Authentication, messaging,
  account settings, admin, and other non-representative screens have not yet
  received the planned individual UX and visual pass. Existing raster app icons
  and external emails are not part of this review set.

## Implementation notes

- `DESIGN.md` is consolidated around the approved reference and replaces the
  contradictory historical palette/navigation rules. Legacy token names remain
  compatibility aliases; status semantics retain their separate colors.
- Bottom tabs reserve their height and safe area. Mobile Property now exposes
  loading and retry feedback in Peek instead of suggesting a successful empty
  result when loading fails.
- Floating details preserve the results rail, place map controls beside the
  panel, support expansion, and retain close/Escape/focus behavior. Property
  cards expose the shared category/id attributes for consistent selection and
  focus restoration.
- Existing dirty work was preserved. A baseline patch and copies of previously
  modified design/discovery files are retained under
  `.cache/pinpoint-redesign-20261016/baseline/`.

## Next review decision

Review the palette, spacing, mobile navigation, floating-panel composition, and
how the same identity translates between discovery and working screens. Further
screen-by-screen redesign and deployment remain outside the completed first
stage. Verification results are recorded alongside this file.
