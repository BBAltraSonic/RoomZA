# Requirements Document

## Introduction

RoomZA is a map-based rental discovery app built with Next.js. The site root (`/`) renders the map-based Discovery experience directly, with no separate landing page. On mobile viewports the Discovery experience presents an interactive map with a draggable bottom sheet of listings.

This feature, Mobile_Map_Discovery, is a focused mobile UI layout and redesign for the map discovery view. It is inspired by a reference design for a map-based "stations near you" discovery screen, adapted to RoomZA's rental listing domain. The redesign defines a coherent mobile layout: a top app bar, a search bar with quick-action icon buttons, a full interactive map with custom listing markers, a draggable bottom sheet with a horizontally scrollable card carousel, a sort/section label, and a bottom navigation bar.

This feature is presentational and layout-focused. It defines how the mobile Discovery view is arranged and behaves, and it adapts reference fields (place name, star rating, distance, travel time) to rental listing fields (listing title, price, distance, beds/baths) while preserving the reference card layout pattern.

Relationship to discovery-pop: The existing `discovery-pop` spec enhances the first-impression framing, value proposition, spotlight, and entrance motion of the Discovery experience across desktop and mobile. Mobile_Map_Discovery defines the underlying mobile layout and chrome (app bar, search bar, markers, bottom sheet carousel, bottom navigation) that the discovery-pop enhancements sit on top of. The two specs MUST remain consistent: Mobile_Map_Discovery does not introduce a separate route, does not replace the Mobile_Sheet concept from discovery-pop, and continues to render at the site root path (`/`). Where discovery-pop defines the Value_Proposition, Primary_Search_CTA, and Discovery_Spotlight, Mobile_Map_Discovery defines the structural mobile container those elements appear within.

The scope is the mobile presentation only (viewport widths below 1024px). Data fetching, filtering logic, and underlying map mechanics are out of scope and are reused as-is.

## Glossary

- **Mobile_Map_Discovery**: The mobile layout of the map-based Discovery experience rendered at the site root path (`/`) at viewport widths below 1024px, composed of the App_Bar, the Search_Bar, the Interactive_Map, the Bottom_Sheet, and the Bottom_Navigation_Bar.
- **App_Bar**: The top bar of Mobile_Map_Discovery containing a Back_Button on the left and a centered Screen_Title.
- **Back_Button**: The control at the left of the App_Bar that returns the visitor to the previous view.
- **Screen_Title**: The text centered in the App_Bar that names the current view, reading "Listings Near You".
- **Search_Bar**: The input field near the top of Mobile_Map_Discovery for finding listings, displaying placeholder text and accompanied by the Filter_Button and the Locate_Button.
- **Filter_Button**: A circular icon button to the right of the Search_Bar that opens listing filter controls.
- **Locate_Button**: A circular icon button to the right of the Search_Bar that recenters the Interactive_Map on the visitor's current location.
- **Interactive_Map**: The map view that fills the upper portion of Mobile_Map_Discovery and displays Listing_Markers.
- **Listing_Marker**: A custom map marker representing a single listing, composed of a rounded thumbnail image of the listing and a colored pin badge beneath the thumbnail.
- **Bottom_Sheet**: The draggable panel overlaying the lower portion of the Interactive_Map, containing the Sheet_Header, the Listing_Carousel, and the Sort_Label.
- **Sheet_Header**: The header row of the Bottom_Sheet containing the Sheet_Title and the See_All_Link.
- **Sheet_Title**: The text in the Sheet_Header reading "Nearby Listings".
- **See_All_Link**: The link in the Sheet_Header that navigates the visitor to a full list of nearby listings.
- **Listing_Carousel**: A horizontally scrollable row of Listing_Cards inside the Bottom_Sheet.
- **Listing_Card**: A card in the Listing_Carousel displaying a listing photo, listing title, star rating with review count, price, distance, and beds/baths.
- **Sort_Label**: The section label below the Listing_Carousel reading "Most Nearest" that indicates the active sort order.
- **Bottom_Navigation_Bar**: The bar at the bottom of Mobile_Map_Discovery containing five Nav_Buttons.
- **Nav_Button**: A circular icon button in the Bottom_Navigation_Bar representing one of the destinations: Home, Discovery, List, Saved, and Profile.
- **Active_Nav_Button**: The Nav_Button representing the currently active destination, visually highlighted with the brand green color token.
- **Mobile_Viewport**: A viewport with a width below 1024px.

## Requirements

### Requirement 1: Top app bar

**User Story:** As a visitor on a phone, I want a clear top bar with a title and a way back, so that I know where I am and can navigate back.

#### Acceptance Criteria

1. WHILE the viewport is a Mobile_Viewport, THE Mobile_Map_Discovery SHALL display the App_Bar fixed at the top of the view so that the App_Bar remains visible while the underlying content scrolls.
2. THE App_Bar SHALL display the Screen_Title "Listings Near You" centered horizontally within the App_Bar, and SHALL truncate the Screen_Title with a trailing ellipsis when the title text exceeds the available horizontal space between the Back_Button and the right edge of the App_Bar.
3. THE App_Bar SHALL display the Back_Button at the left of the App_Bar with a touch target measuring at least 44 by 44 CSS pixels.
4. WHEN the visitor activates the Back_Button by tap or by keyboard (Enter or Space), THE Mobile_Map_Discovery SHALL return the visitor to the previously displayed view.
5. IF the visitor activates the Back_Button when no previously displayed view exists within the current session, THEN THE Mobile_Map_Discovery SHALL navigate the visitor to the application's default landing view.
6. THE Back_Button SHALL expose an accessible name that describes its navigation action.
7. WHILE the Back_Button has keyboard focus, THE Mobile_Map_Discovery SHALL display a visible focus indicator on the Back_Button.

### Requirement 2: Search bar with quick actions

**User Story:** As a visitor, I want a search field with quick filter and locate actions, so that I can narrow listings and recenter the map.

#### Acceptance Criteria

1. THE Mobile_Map_Discovery SHALL display the Search_Bar in the region immediately below the App_Bar, with no other interactive control positioned between the App_Bar and the Search_Bar.
2. WHILE the Search_Bar contains zero characters of visitor-entered text, THE Search_Bar SHALL display placeholder text that names both supported search inputs: listing name and location.
3. THE Mobile_Map_Discovery SHALL display the Filter_Button and the Locate_Button horizontally aligned with and positioned to the right of the Search_Bar within the same Search_Bar region.
4. WHEN the visitor activates the Filter_Button, THE Mobile_Map_Discovery SHALL display the listing filter controls within 1 second of the activation.
5. WHEN the visitor activates the Locate_Button and the visitor's current location is determined within 10 seconds, THE Mobile_Map_Discovery SHALL recenter the Interactive_Map so that the visitor's current location is at the center of the visible map area within 2 seconds of the location being determined.
6. IF the visitor's current location cannot be determined within 10 seconds of the Locate_Button being activated, or location access is denied, THEN THE Mobile_Map_Discovery SHALL display a message indicating that the current location is unavailable and SHALL keep the Interactive_Map at its center and zoom level held immediately before activation.
7. THE Search_Bar, the Filter_Button, and the Locate_Button SHALL each expose a non-empty accessible name that identifies its purpose to assistive technologies.
8. THE Search_Bar SHALL be reachable using sequential keyboard navigation, SHALL display a visible focus indicator when focused, and SHALL accept text entry of 1 to 200 characters.

### Requirement 3: Interactive map with listing markers

**User Story:** As a visitor, I want a map that fills most of the screen and shows where listings are, so that I can browse listings by location.

#### Acceptance Criteria

1. WHILE the viewport is a Mobile_Viewport, THE Mobile_Map_Discovery SHALL display the Interactive_Map spanning the full viewport width and filling the vertical area between the bottom edge of the Search_Bar and the top edge of the Bottom_Sheet.
2. WHEN listing data for the current map view is available, THE Mobile_Map_Discovery SHALL display one Listing_Marker for each listing in the current map view, up to a maximum of 100 Listing_Markers.
3. THE Listing_Marker SHALL display a rounded thumbnail image of the listing and a pin badge using the brand green color token beneath the thumbnail.
4. WHEN the visitor activates a Listing_Marker, THE Mobile_Map_Discovery SHALL scroll the Listing_Carousel to the Listing_Card corresponding to the activated Listing_Marker within 300 milliseconds.
5. WHEN the visitor activates a Listing_Marker, THE Mobile_Map_Discovery SHALL render the activated Listing_Marker with a visual distinction that differentiates it from the non-activated Listing_Markers.
6. IF a listing thumbnail image fails to load within 5 seconds, THEN THE Listing_Marker SHALL display a placeholder image in place of the thumbnail.
7. WHEN no listings are in the current map view and loading has completed without error, THE Mobile_Map_Discovery SHALL display no Listing_Markers on the Interactive_Map.
8. THE Mobile_Map_Discovery SHALL respond to pointer input over the Interactive_Map within 100 milliseconds of receiving the pointer input.

### Requirement 4: Draggable bottom sheet

**User Story:** As a visitor, I want a bottom sheet I can drag, so that I can see more listings or more map as needed.

#### Acceptance Criteria

1. THE Mobile_Map_Discovery SHALL display the Bottom_Sheet overlaying the lower portion of the Interactive_Map.
2. THE Bottom_Sheet SHALL display the Sheet_Header containing the Sheet_Title "Nearby Listings" and the See_All_Link.
3. WHILE the visitor drags the Bottom_Sheet, THE Mobile_Map_Discovery SHALL update the Bottom_Sheet height to track the pointer position within 100 milliseconds of each drag movement.
4. WHEN the visitor drags the Bottom_Sheet upward, THE Mobile_Map_Discovery SHALL increase the portion of the viewport height occupied by the Bottom_Sheet up to a maximum expanded height of 90 percent of the viewport height.
5. WHEN the visitor drags the Bottom_Sheet downward, THE Mobile_Map_Discovery SHALL decrease the portion of the viewport height occupied by the Bottom_Sheet down to a minimum collapsed height of 25 percent of the viewport height.
6. IF the visitor drags the Bottom_Sheet beyond the maximum expanded height of 90 percent or below the minimum collapsed height of 25 percent of the viewport height, THEN THE Mobile_Map_Discovery SHALL clamp the Bottom_Sheet height to the nearest of those two bounds.
7. WHEN the visitor releases the Bottom_Sheet after a drag, THE Mobile_Map_Discovery SHALL animate the Bottom_Sheet to the nearer of the minimum collapsed height of 25 percent or the maximum expanded height of 90 percent of the viewport height within 300 milliseconds.
8. WHILE the Bottom_Sheet is at its minimum collapsed height of 25 percent of the viewport height, THE Mobile_Map_Discovery SHALL keep the Sheet_Header and at least one row of the Listing_Carousel visible within the viewport.
9. WHEN the visitor activates the See_All_Link, THE Mobile_Map_Discovery SHALL display the full list of nearby listings occupying at least the maximum expanded height of 90 percent of the viewport height.
10. THE See_All_Link SHALL expose an accessible name that describes its action.

### Requirement 5: Listing card carousel

**User Story:** As a visitor, I want to swipe through nearby listing cards with key details, so that I can compare listings quickly.

#### Acceptance Criteria

1. THE Bottom_Sheet SHALL display the Listing_Carousel as a horizontally scrollable row of Listing_Cards that the visitor can scroll by horizontal swipe gesture.
2. THE Listing_Card SHALL display a listing photo, a listing title of 1 to 80 characters, a star rating from 0.0 to 5.0 inclusive shown to one decimal place, a review count as a non-negative integer from 0 to 9,999, a price as a value greater than 0 with a currency indication, a distance, and a beds/baths summary.
3. THE Listing_Card SHALL display the distance as a value from 0.0 to 999.9 inclusive shown to one decimal place with a distance unit, and SHALL display the beds/baths summary as non-negative integer bedroom and bathroom counts each from 0 to 99.
4. WHEN the visitor activates a Listing_Card, THE Mobile_Map_Discovery SHALL open the detail view for the listing represented by the activated Listing_Card within 1 second.
5. IF a listing photo fails to load within 10 seconds, THEN THE Listing_Card SHALL display a placeholder image in place of the photo.
6. WHILE listings for the current map view are loading, THE Listing_Carousel SHALL display a loading indication.
7. WHEN no listings are in the current map view and loading has completed without error, THE Bottom_Sheet SHALL display an empty-state message in place of the Listing_Cards.
8. IF loading the listings for the current map view fails or does not complete within 30 seconds, THEN THE Listing_Carousel SHALL display an error indication with a retry control, and SHALL retain the previously displayed Listing_Cards.
9. WHEN the visitor activates the retry control, THE Listing_Carousel SHALL re-request the listings for the current map view and display the loading indication.

### Requirement 6: Sort section label

**User Story:** As a visitor, I want to see how listings are ordered, so that I understand which listings appear first.

#### Acceptance Criteria

1. WHILE the Listing_Carousel contains at least one Listing_Card, THE Bottom_Sheet SHALL display the Sort_Label positioned directly below the Listing_Carousel.
2. THE Sort_Label SHALL display the exact text "Most Nearest" to indicate that Listing_Cards are ordered by ascending distance from the visitor.
3. WHEN listings are ordered by ascending distance, THE Listing_Carousel SHALL arrange the Listing_Cards from left to right such that each Listing_Card's distance from the visitor is greater than or equal to the distance of the Listing_Card immediately preceding it.
4. IF two or more Listing_Cards have an equal distance from the visitor, THEN THE Listing_Carousel SHALL place those Listing_Cards consecutively in any relative order among themselves while preserving the non-decreasing distance order with respect to all other Listing_Cards.
5. IF the visitor's distance to one or more listings cannot be determined, THEN THE Listing_Carousel SHALL place each affected Listing_Card after all Listing_Cards with a determinable distance, and THE Sort_Label SHALL continue to display the text "Most Nearest".
6. WHILE the Listing_Carousel contains zero Listing_Cards, THE Bottom_Sheet SHALL NOT display the Sort_Label.

### Requirement 7: Bottom navigation bar

**User Story:** As a visitor, I want a bottom navigation bar, so that I can move between the main areas of the app.

#### Acceptance Criteria

1. WHILE the viewport is a Mobile_Viewport, THE Mobile_Map_Discovery SHALL display the Bottom_Navigation_Bar anchored to the bottom edge of the view so that it remains visible while page content scrolls.
2. THE Bottom_Navigation_Bar SHALL display exactly five Nav_Buttons in left-to-right order representing the Home, Discovery, List, Saved, and Profile destinations.
3. WHILE no other Nav_Button has been activated since load, THE Bottom_Navigation_Bar SHALL render the Discovery Nav_Button as the Active_Nav_Button using the brand green color token.
4. WHEN the visitor activates a Nav_Button, THE Mobile_Map_Discovery SHALL navigate to the destination represented by the activated Nav_Button within 1 second.
5. WHEN the visitor activates a Nav_Button, THE Bottom_Navigation_Bar SHALL render the activated Nav_Button as the Active_Nav_Button using the brand green color token and render all other Nav_Buttons as inactive.
6. THE Bottom_Navigation_Bar SHALL render exactly one Active_Nav_Button at any time.
7. THE Bottom_Navigation_Bar SHALL assign each Nav_Button an accessible name equal to the name of the destination it represents (Home, Discovery, List, Saved, or Profile).
8. IF navigation to the destination represented by an activated Nav_Button does not complete within 1 second, THEN THE Mobile_Map_Discovery SHALL display an error indication that navigation failed and SHALL retain the previously Active_Nav_Button as the Active_Nav_Button.

### Requirement 8: Responsive mobile layout

**User Story:** As a visitor on different phone sizes, I want the layout to fit my screen, so that all controls remain usable.

#### Acceptance Criteria

1. WHILE the viewport width is from 360px to 1023px inclusive, THE Mobile_Map_Discovery SHALL render the App_Bar, the Search_Bar, the Interactive_Map, the Bottom_Sheet, and the Bottom_Navigation_Bar with no horizontal overflow, such that no rendered element extends beyond the viewport's left or right bounds and no horizontal scrollbar appears.
2. WHILE the viewport width is from 360px to 1023px inclusive, THE Mobile_Map_Discovery SHALL keep the App_Bar, the Search_Bar, and the Bottom_Navigation_Bar fully within the viewport bounds, with each of these elements rendered with all four edges inside the viewport and none of their content clipped.
3. WHILE the viewport width is from 360px to 1023px inclusive, THE Mobile_Map_Discovery SHALL render every interactive control within the App_Bar, the Search_Bar, and the Bottom_Navigation_Bar with a touch target of at least 44 by 44 CSS pixels.
4. THE Mobile_Map_Discovery SHALL render at the site root path (`/`) without redirecting the visitor to any other route.
5. WHEN the viewport is resized to a width of 1024px or greater, THE Mobile_Map_Discovery SHALL replace the mobile layout with the non-mobile Discovery layout within 500 milliseconds of the resize event completing.
6. WHEN the viewport is resized from a width of 1024px or greater to a width of 1023px or less, THE Mobile_Map_Discovery SHALL replace the non-mobile Discovery layout with the mobile layout within 500 milliseconds of the resize event completing.

### Requirement 9: Accessibility of mobile chrome

**User Story:** As a visitor using assistive technology or keyboard navigation, I want the mobile controls to be operable and announced, so that the experience is inclusive.

#### Acceptance Criteria

1. THE Back_Button, the Filter_Button, the Locate_Button, the See_All_Link, and every Nav_Button SHALL be reachable using sequential keyboard navigation in an order that matches their visual top-to-bottom, left-to-right arrangement, without requiring a pointing device and without creating a keyboard trap.
2. WHILE any of the Back_Button, the Filter_Button, the Locate_Button, the See_All_Link, the Listing_Cards, or the Nav_Buttons has keyboard focus, THE Mobile_Map_Discovery SHALL display a visible focus indicator on the focused control with a contrast ratio of at least 3:1 against the control's adjacent background colors.
3. THE Mobile_Map_Discovery SHALL maintain a text contrast ratio of at least 4.5:1 between the Screen_Title text and its background and between each Listing_Card text element and its background.
4. THE Active_Nav_Button SHALL convey its active state through at least one non-color visual means (such as a persistent text label, an icon, an underline, or a shape change) so that the active state is determinable without relying on the brand green color token.
5. WHEN the visitor activates a Listing_Marker by keyboard, THE Mobile_Map_Discovery SHALL move keyboard focus to the corresponding Listing_Card.
6. WHEN assistive technology focuses the Back_Button, the Filter_Button, the Locate_Button, the See_All_Link, or any Nav_Button, THE Mobile_Map_Discovery SHALL expose an accessible name and a control role for that focused control.

### Requirement 10: Consistency with the Discovery experience

**User Story:** As a product owner, I want the mobile redesign to stay consistent with the existing Discovery experience, so that discovery-pop enhancements continue to work.

#### Acceptance Criteria

1. WHILE the viewport width is 1023px or less, WHEN the visitor requests the site root path (`/`), THE Mobile_Map_Discovery SHALL render as the mobile presentation of the Discovery experience without registering or redirecting to any separate route.
2. WHEN the Mobile_Map_Discovery renders, THE Mobile_Map_Discovery SHALL present the Value_Proposition and the Primary_Search_CTA defined by the discovery-pop feature within its mobile container.
3. IF the Value_Proposition or the Primary_Search_CTA defined by the discovery-pop feature fails to load, THEN THE Mobile_Map_Discovery SHALL display an error indication for the affected element while remaining at the site root path (`/`).
4. THE Mobile_Map_Discovery SHALL render the Bottom_Sheet such that the Bottom_Sheet fulfills every interaction and state defined for the Mobile_Sheet by the discovery-pop feature.
5. THE Mobile_Map_Discovery SHALL apply the defined brand color tokens, including the `forest` and `ink` tokens, to the Screen_Title, the Active_Nav_Button, and the Listing_Marker pin badge, and SHALL NOT use literal color values outside the defined brand color tokens for those elements.
