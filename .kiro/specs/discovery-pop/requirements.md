# Requirements Document

## Introduction

RoomZA is a map-based rental discovery app. The site root (`/`) renders the map-based Discovery experience directly: there is no separate landing page and no hero screen. A brand-new visitor arrives straight onto an interactive map with a listings sidebar (desktop) or a draggable bottom sheet (mobile).

This feature enhances the existing Discovery experience so it carries the first-impression weight a landing page or hero screen would normally provide. The goal is to make Discovery "pop": establish a clear value proposition for a first-time visitor, strengthen the visual hierarchy of the primary view, surface obvious calls-to-action, and create an engaging, welcoming entrance — all in-context, without introducing a separate route, landing page, or full-screen hero.

The scope is presentational and orientation-focused. It does not change how listings are fetched, filtered, or rendered as data, nor the underlying map mechanics. It enhances the framing, hierarchy, copy, motion, and onboarding cues around the existing Discovery surfaces.

## Glossary

- **Discovery_Page**: The map-based experience rendered at the site root path (`/`), composed of the interactive map, the desktop sidebar, the mobile bottom sheet, the search/filter chrome, and listing cards.
- **Discovery_Spotlight**: A first-impression UI element rendered in-context on the Discovery_Page that presents the value proposition and a primary call-to-action to orient a new visitor. It is part of the Discovery_Page, not a separate route or full-screen page.
- **Value_Proposition**: The headline and supporting text that communicate what RoomZA offers (interactive map-based rental discovery across South Africa) and what the visitor can do next.
- **Primary_Search_CTA**: The most visually prominent call-to-action on the Discovery_Page that directs the visitor to search a location or explore the map.
- **Orientation_Summary**: The text that tells the visitor the current map location context and the count of homes currently in view.
- **Desktop_Sidebar**: The floating sidebar (`aside`) shown at viewport widths of 1024px and above (the 1024px boundary is inclusive of desktop presentation), currently titled "RoomZA Discovery" with the heading "Find your next home."
- **Mobile_Sheet**: The draggable bottom sheet shown at viewport widths below 1024px, currently titled "Discovery" / "Homes in view".
- **First_Time_Visitor**: A visitor for whom no record of a prior Discovery_Spotlight dismissal or prior Discovery_Page interaction exists in browser-persisted state.
- **Returning_Visitor**: A visitor for whom a record of a prior Discovery_Spotlight dismissal exists in browser-persisted state.
- **Reduced_Motion_Preference**: The browser/OS setting exposed via the `prefers-reduced-motion: reduce` media query.
- **Entrance_Animation**: A one-time visual transition (for example fade and slide) applied to Discovery_Page elements when the Discovery_Page first renders.

## Requirements

### Requirement 1: First-impression value proposition on arrival

**User Story:** As a first-time visitor landing directly on the map, I want an immediate, clear statement of what RoomZA offers and what I can do, so that I understand the product without needing a landing page.

#### Acceptance Criteria

1. WHEN the Discovery_Page first renders, THE Discovery_Page SHALL display the Value_Proposition communicating that RoomZA provides interactive map-based rental discovery across South Africa within 3 seconds of the initial render starting.
2. THE Value_Proposition SHALL include a primary headline of 1 to 80 characters and supporting text of 1 to 200 characters that describes at least one action the visitor can take, either searching a location or exploring the map.
3. THE Value_Proposition SHALL be fully rendered within the initial viewport bounds, with no portion clipped or hidden, such that the visitor sees it without scrolling, panning the map, or opening any additional panel on first render.
4. WHERE the viewport width is 1024px or greater, THE Discovery_Page SHALL present the Value_Proposition within the Desktop_Sidebar.
5. WHERE the viewport width is below 1024px, THE Discovery_Page SHALL present the Value_Proposition within the Mobile_Sheet or the Discovery_Spotlight.
6. IF the Value_Proposition content cannot be loaded within 3 seconds of the initial render starting, THEN THE Discovery_Page SHALL display a fallback message indicating that product information is temporarily unavailable while keeping the interactive map available for use.

### Requirement 2: Strengthened visual hierarchy

**User Story:** As a visitor, I want the primary view to have a clear visual focal point, so that my attention is drawn to the most important content first.

#### Acceptance Criteria

1. THE Discovery_Page SHALL render the Value_Proposition headline at a type size at least 1.25 times the type size of the listing card titles and at least 1.25 times the type size of the Orientation_Summary text.
2. THE Discovery_Page SHALL render the Primary_Search_CTA with the highest visual weight of any control on the Discovery_Page, where higher visual weight is expressed as a solid filled background using a brand color token and a type size no smaller than that of any other control.
3. THE Discovery_Page SHALL render secondary actions, including the "Add listing" control and the viewing-calendar control, without a solid filled background and at a type size no larger than the Primary_Search_CTA, so that their visual weight is lower than the Primary_Search_CTA.
4. THE Discovery_Page SHALL maintain a text contrast ratio of at least 4.5:1 between the Value_Proposition text and its background.
5. THE Discovery_Page SHALL render the Value_Proposition text and the Primary_Search_CTA using the defined brand color tokens, including the `forest` and `ink` tokens.

### Requirement 3: Obvious primary call-to-action

**User Story:** As a first-time visitor, I want an obvious next step, so that I can begin finding a home without guessing.

#### Acceptance Criteria

1. WHEN the Discovery_Page loads, THE Discovery_Page SHALL display exactly one Primary_Search_CTA, fully visible within the initial viewport without requiring scrolling, that directs the visitor to search a location or explore the map.
2. WHEN the visitor activates the Primary_Search_CTA, THE Discovery_Page SHALL move keyboard focus to the location search input within 500 milliseconds.
3. THE Primary_Search_CTA SHALL be reachable using sequential keyboard navigation.
4. WHILE the Primary_Search_CTA has keyboard focus, THE Discovery_Page SHALL display a visible focus indicator on the Primary_Search_CTA.
5. THE Primary_Search_CTA SHALL expose an accessible name that describes its action.
6. WHILE the viewport width is below 1024 pixels, THE Discovery_Page SHALL display the Primary_Search_CTA without requiring the visitor to expand the Mobile_Sheet.

### Requirement 4: Orientation for map-first arrival

**User Story:** As a visitor who lands straight on a map, I want to know where I am looking and how many homes are shown, so that I can orient myself quickly.

#### Acceptance Criteria

1. WHEN the Discovery_Page first renders, THE Orientation_Summary SHALL display the current map location context, using the active search query or resolved map location name when either is available, and defaulting to "South Africa" only when neither is available.
2. WHEN the count of homes in view changes, THE Orientation_Summary SHALL update to display the current count of homes in view as a non-negative integer within 1 second of the change.
3. WHILE listings for the current viewport are loading, THE Orientation_Summary SHALL display a loading indication in place of the homes-in-view count, regardless of any previous loading state.
4. WHEN no homes are in view and loading has completed without error, THE Discovery_Page SHALL display the existing empty-state capture content prompting the visitor to explore the map or join the area waitlist.
5. IF loading the listings for the current viewport fails with an error or does not complete within 10 seconds, THEN THE Orientation_Summary SHALL display an error indication with a retry control while retaining the last displayed location context.

### Requirement 5: Welcoming entrance motion

**User Story:** As a visitor, I want the Discovery experience to feel engaging when it loads, so that the first impression is inviting.

#### Acceptance Criteria

1. WHEN the Discovery_Page first renders, THE Discovery_Page SHALL begin playing the Entrance_Animation on the Value_Proposition and the Primary_Search_CTA within 100 milliseconds of the first render.
2. THE Entrance_Animation SHALL complete within 700 milliseconds of the Discovery_Page first render.
3. IF the Reduced_Motion_Preference is set to reduce at the time of Discovery_Page first render, THEN THE Discovery_Page SHALL display the Value_Proposition and the Primary_Search_CTA in their final state without the Entrance_Animation.
4. IF the Reduced_Motion_Preference changes to reduce while the Entrance_Animation is playing, THEN THE Discovery_Page SHALL allow the in-progress Entrance_Animation to complete and SHALL apply the Reduced_Motion_Preference on the next Discovery_Page first render.
5. WHILE the Entrance_Animation is playing, THE Discovery_Page SHALL respond to pointer input over the interactive map area within 100 milliseconds of receiving the pointer input.
6. WHEN the Entrance_Animation has completed, THE Discovery_Page SHALL respond to pointer input over the interactive map area within 100 milliseconds of receiving the pointer input.
7. IF the Entrance_Animation fails to start or does not complete within 700 milliseconds of the Discovery_Page first render, THEN THE Discovery_Page SHALL display the Value_Proposition and the Primary_Search_CTA in their final state.

### Requirement 6: Non-recurring welcome for returning visitors

**User Story:** As a returning visitor, I want the introductory spotlight to step aside after I have seen it, so that I can get straight to browsing.

#### Acceptance Criteria

1. WHERE the visitor is a First_Time_Visitor, THE Discovery_Page SHALL display the Discovery_Spotlight on first render.
2. WHEN the visitor dismisses the Discovery_Spotlight, THE Discovery_Page SHALL remove the Discovery_Spotlight from view within 500 milliseconds.
3. WHERE the visitor is a Returning_Visitor, THE Discovery_Page SHALL render without the Discovery_Spotlight while still displaying the Value_Proposition within the Desktop_Sidebar or Mobile_Sheet.
4. IF the visitor is a Returning_Visitor and the dismissal record cannot be read, THEN THE Discovery_Page SHALL display the Discovery_Spotlight alongside the Value_Proposition.
5. THE Discovery_Spotlight SHALL provide a dismissal control that is operable by both pointer and keyboard, exposes an accessible name, and dismisses the Discovery_Spotlight when activated.
6. WHEN the visitor activates the Primary_Search_CTA from within the Discovery_Spotlight, THE Discovery_Page SHALL dismiss the Discovery_Spotlight.
7. WHERE the visitor is a First_Time_Visitor, THE Discovery_Page SHALL display the Value_Proposition within the Desktop_Sidebar or Mobile_Sheet concurrently with the Discovery_Spotlight.
8. WHEN the visitor dismisses the Discovery_Spotlight, THE Discovery_Page SHALL record the dismissal in browser-persisted state.
9. IF recording the dismissal in browser-persisted state fails, THEN THE Discovery_Page SHALL keep the Discovery_Spotlight removed from view for the remainder of the current browsing session and SHALL continue displaying the Value_Proposition within the Desktop_Sidebar or Mobile_Sheet.

### Requirement 7: Discovery remains the single primary view

**User Story:** As a product owner, I want the enhancements to stay in-context on the map view, so that we avoid introducing a separate landing page or hero screen.

#### Acceptance Criteria

1. THE Discovery_Page SHALL render at the site root path (`/`) as the first view presented to the visitor without redirecting the visitor to any other route.
2. WHILE the Discovery_Spotlight is displayed, THE Discovery_Page SHALL keep the interactive map mounted and rendered behind the Discovery_Spotlight.
3. WHERE the viewport width is 1024px or greater, WHILE the Discovery_Spotlight is displayed, THE Discovery_Page SHALL keep at least 30% of the viewport width displaying the visible interactive map alongside the Discovery_Spotlight.
4. WHEN the visitor activates any control within the Discovery_Spotlight, the Value_Proposition, or the Primary_Search_CTA, THE Discovery_Page SHALL keep the visitor on the site root path (`/`) without navigating to any other route.
5. WHILE the Discovery_Spotlight is displayed, THE Discovery_Page SHALL render the Discovery_Spotlight as an in-context element that does not occupy the full viewport and does not fully obscure the interactive map, the Desktop_Sidebar, or the Mobile_Sheet.

### Requirement 8: Responsive presentation

**User Story:** As a visitor on any device, I want the enhanced Discovery experience to fit my screen, so that the first impression is coherent on mobile and desktop.

#### Acceptance Criteria

1. WHILE the viewport width is 1024px or greater, THE Discovery_Page SHALL present the Value_Proposition and Primary_Search_CTA within the Desktop_Sidebar layout.
2. WHILE the viewport width is below 1024px, THE Discovery_Page SHALL present the Value_Proposition and Primary_Search_CTA within the Mobile_Sheet or Discovery_Spotlight layout.
3. WHEN the viewport is resized across the 1024px boundary, THE Discovery_Page SHALL render the layout corresponding to the new viewport width within 500 milliseconds.
4. THE Discovery_Page SHALL render the Value_Proposition text without horizontal overflow at viewport widths from 360px to 3840px.
5. THE Discovery_Page SHALL render the Primary_Search_CTA fully within the viewport bounds without horizontal overflow at viewport widths from 360px to 3840px.

### Requirement 9: Accessibility of the enhanced experience

**User Story:** As a visitor using assistive technology or keyboard navigation, I want the enhanced Discovery elements to be operable and announced, so that the first impression is inclusive.

#### Acceptance Criteria

1. WHILE the Discovery_Spotlight is displayed, THE Discovery_Spotlight SHALL expose to assistive technology a programmatically determinable accessible name and the dialog role.
2. WHILE the Discovery_Spotlight is displayed, THE Discovery_Page SHALL allow keyboard focus to reach the Primary_Search_CTA and the dismissal control using forward and backward sequential keyboard navigation, AND THE Discovery_Page SHALL allow keyboard focus to move away from every focusable control within the Discovery_Spotlight without requiring pointer input.
3. WHILE the Discovery_Spotlight is displayed, THE Discovery_Page SHALL dismiss the Discovery_Spotlight when the visitor presses the Escape key or activates the dismissal control by keyboard.
4. WHEN the Discovery_Spotlight is dismissed by keyboard, THE Discovery_Page SHALL move keyboard focus to the Primary_Search_CTA, or when the Primary_Search_CTA is not present, to a persistent focusable control within the Discovery_Page.
5. THE Discovery_Page SHALL render the Value_Proposition headline as an element whose heading role and heading level are programmatically determinable by assistive technology.

### Requirement 10: First impression does not delay interactivity

**User Story:** As a visitor, I want the page to remain fast and stable while the enhanced first impression appears, so that the experience feels responsive rather than janky.

#### Acceptance Criteria

1. THE Discovery_Page SHALL render the Value_Proposition and Primary_Search_CTA without introducing cumulative layout shift greater than 0.1 of the existing map, Desktop_Sidebar, or Mobile_Sheet from Discovery_Page first render through completion of the Entrance_Animation.
2. WHEN the initial map bounds resolve, THE Discovery_Page SHALL trigger the existing viewport listing fetch regardless of whether the Discovery_Spotlight is displayed.
3. WHILE the Discovery_Spotlight is displayed, THE Discovery_Page SHALL keep the location search input able to receive keyboard focus and accept text entry.
4. THE Discovery_Page SHALL make the Primary_Search_CTA and the location search input able to receive input within 100 milliseconds of first render, without waiting for the Entrance_Animation to complete.
