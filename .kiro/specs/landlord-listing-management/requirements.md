# Requirements Document

## Introduction

RoomZA is currently a map-first, renter-oriented rental discovery and structured application management product. Landlords already have a baseline set of capabilities: a dashboard listing their properties, listing create/edit server actions, image upload, publish/unpublish, a per-listing applicant queue with status decisions, viewing proposals, and chat. However, the overall experience leans heavily toward renters.

This feature rebalances the product by making the landlord experience richer and more first-class. It extends the existing listing lifecycle (currently only draft and published) to include archiving, restoring, deleting, and duplicating listings; improves the add/manage listing flow with draft persistence and a publish-readiness checklist; introduces a consolidated landlord workspace with listing search, filtering, and sorting; surfaces per-listing performance insights; consolidates applicant management across listings; and gives landlords clearer control over viewing scheduling.

This specification builds on and extends the existing implementation (the `listings`, `listing_images`, `applications`, and `viewings` data, the `listing_status` enum which already defines `draft`, `published`, and `archived`, and the existing server actions). It does not re-specify the baseline CRUD and publish behavior except where that behavior is being changed or extended.

## Glossary

- **Landlord**: An authenticated user whose profile role is `landlord`.
- **Renter**: An authenticated user whose profile role is `renter`.
- **Listing**: A rental property record owned by a single Landlord, with a lifecycle status of Draft, Published, or Archived.
- **Draft**: A Listing with status `draft` that is not visible in renter-facing discovery.
- **Published_Listing**: A Listing with status `published` that is visible in renter-facing discovery.
- **Archived_Listing**: A Listing with status `archived` that is hidden from renter-facing discovery and from the Landlord's default active list, but retained with its data and applicant history.
- **Listing_Workspace**: The Landlord-facing area of the application, rooted at `/dashboard`, where a Landlord manages listings, applicants, and viewings.
- **Listing_Manager**: The system component responsible for Listing lifecycle operations (create, update, publish, unpublish, archive, restore, delete, duplicate).
- **Listing_Form**: The system component that captures and validates Listing field input during creation and editing.
- **Publish_Validator**: The system component that determines whether a Listing satisfies all conditions required to be published.
- **Publish_Readiness_Checklist**: A Landlord-visible itemized summary, produced by the Publish_Validator, of which publish conditions a Draft has met and which remain outstanding.
- **Applicant_Manager**: The system component that presents and manages applications submitted to a Landlord's Listings.
- **Application**: A Renter's submitted request to rent a specific Listing, with a status of `submitted`, `under_review`, `shortlisted`, `approved`, `rejected`, or `withdrawn`.
- **Viewing_Scheduler**: The system component that manages viewing slot proposals and bookings between a Landlord and Renters.
- **Listing_Insights**: The system component that computes and displays per-Listing performance metrics for a Landlord.
- **MIN_LISTING_IMAGES**: The configured minimum number of images required to publish a Listing (currently 3).

## Requirements

### Requirement 1: Landlord Workspace Navigation

**User Story:** As a Landlord, I want a dedicated workspace with clear navigation between my listings, applicants, and viewings, so that I can manage my rental activity without the experience feeling renter-oriented.

#### Acceptance Criteria

1. WHEN a Landlord opens any Listing_Workspace route, THE Listing_Workspace SHALL display navigation entries for Listings, Applicants, and Viewings.
2. WHEN a Landlord selects a navigation entry, THE Listing_Workspace SHALL replace the currently displayed view with the view corresponding to the selected entry.
3. WHILE a navigation view is displayed, THE Listing_Workspace SHALL visually distinguish the active navigation entry from all other navigation entries.
4. IF a Renter requests any Listing_Workspace route, THEN THE Listing_Workspace SHALL redirect the Renter to the Renter home route `/applications`.
5. IF an unauthenticated user requests any Listing_Workspace route, THEN THE Listing_Workspace SHALL redirect the user to the sign-in route.
6. IF the requesting user's role is no longer `landlord` when a Listing_Workspace route is requested, THEN THE Listing_Workspace SHALL redirect the user to the route corresponding to the current role on that request.
7. WHEN a Landlord opens the Listing_Workspace root route `/dashboard` without selecting a specific navigation entry, THE Listing_Workspace SHALL display the Listings view as the default active view.

### Requirement 2: Listing Creation and Draft Persistence

**User Story:** As a Landlord, I want to add a listing and have my progress saved as a draft, so that I can complete a listing across multiple sessions without losing data.

#### Acceptance Criteria

1. WHEN a Landlord submits the Listing_Form with all required fields valid, THE Listing_Manager SHALL create a Listing with status `draft` owned by the requesting Landlord and return the new Listing identifier.
2. IF a Landlord submits the Listing_Form with one or more invalid fields, THEN THE Listing_Form SHALL reject the submission, create no Listing, retain the entered field values and amenity selections, and display a field-level error message identifying each invalid field and the reason it is invalid.
3. WHEN a Landlord saves a Draft, THE Listing_Manager SHALL persist all entered field values and amenity selections, including when required fields are incomplete, so that the same values are present unchanged when the Draft is reopened in a later session.
4. WHERE a Listing has status `draft`, THE Listing_Workspace SHALL label the Listing as a Draft and indicate that it is not visible to Renters.
5. WHERE a Listing has status `published`, THE Listing_Manager SHALL make the Listing visible in renter-facing discovery results.
6. WHEN a Landlord uploads an image to a Listing owned by that Landlord in a supported format (JPEG, PNG, or WebP) that is 10 MB or smaller, THE Listing_Manager SHALL store the image and associate it with the Listing.
7. IF a Landlord uploads a file that is not a supported image format or exceeds the 10 MB maximum file size, THEN THE Listing_Manager SHALL reject the upload, leave the Listing's existing images unchanged, and return a descriptive error message identifying whether the format condition, the size condition, or both caused the rejection.

### Requirement 3: Publish Readiness Checklist

**User Story:** As a Landlord, I want to see exactly what is missing before I can publish a listing, so that I can complete the listing and publish it without trial and error.

#### Acceptance Criteria

1. WHEN a Landlord views a Draft owned by that Landlord, THE Publish_Validator SHALL produce a Publish_Readiness_Checklist that marks each required Listing field as met when it contains a non-empty valid value and as outstanding otherwise, and marks the minimum image condition as met when the Draft has at least MIN_LISTING_IMAGES images and as outstanding otherwise.
2. WHILE a Draft owned by the Landlord has one or more outstanding publish conditions, THE Listing_Workspace SHALL display the total count of outstanding conditions for that Draft and SHALL provide the corresponding Publish_Readiness_Checklist identifying each condition as met or outstanding.
3. WHEN a Landlord requests to publish a Listing owned by that Landlord in which every required Listing field contains a non-empty valid value and that has at least MIN_LISTING_IMAGES images, THE Listing_Manager SHALL set the Listing status to `published`.
4. IF a Landlord requests to publish a Listing that has one or more outstanding publish conditions, THEN THE Listing_Manager SHALL reject the publish request, leave the Listing status unchanged at `draft`, and return the list of outstanding conditions.
5. WHEN a Landlord requests to unpublish a Published_Listing owned by that Landlord, THE Listing_Manager SHALL set the Listing status to `draft`.
6. IF a Landlord requests to publish or unpublish a Listing that is not owned by that Landlord, THEN THE Listing_Manager SHALL reject the request, leave the Listing status unchanged, and return an access-denied error.

### Requirement 4: Listing Archiving and Restoration

**User Story:** As a Landlord, I want to archive listings that are no longer available and restore them later, so that I can remove inactive listings from view without losing their data or applicant history.

#### Acceptance Criteria

1. WHEN a Landlord requests to archive a Listing owned by that Landlord that has status `draft` or `published`, THE Listing_Manager SHALL set the Listing status to `archived`.
2. WHEN a Listing is set to `archived`, THE Listing_Manager SHALL remove the Listing from renter-facing discovery results.
3. WHEN a Listing is set to `archived`, THE Listing_Manager SHALL retain the Listing record, its images, and its associated Applications as a single atomic operation, and IF any part of the retention cannot be guaranteed, THEN THE Listing_Manager SHALL fail the archive operation, leave the Listing in its prior status, and return an error.
4. WHILE a Landlord views the default Listings view, THE Listing_Workspace SHALL exclude Archived_Listings from that view.
5. WHEN a Landlord requests to view archived listings, THE Listing_Workspace SHALL display only the requesting Landlord's Archived_Listings.
6. WHEN a Landlord requests to restore an Archived_Listing owned by that Landlord, THE Listing_Manager SHALL set the Listing status to `draft`.
7. IF a Landlord requests to archive a Listing that already has status `archived`, THEN THE Listing_Manager SHALL reject the request, leave the Listing status unchanged, and return a message indicating the Listing is already archived.
8. IF a Landlord requests to restore a Listing that is not owned by that Landlord, THEN THE Listing_Manager SHALL evaluate ownership before any other condition and SHALL reject the request with an access-denied error.

### Requirement 5: Listing Deletion

**User Story:** As a Landlord, I want to permanently delete a listing I no longer need, so that my workspace only contains relevant listings.

#### Acceptance Criteria

1. WHEN a Landlord requests to delete a Listing owned by that Landlord, THE Listing_Manager SHALL prompt for an explicit confirmation and SHALL NOT remove the Listing until that confirmation is received.
2. WHEN a Landlord confirms deletion of a Listing, THE Listing_Manager SHALL remove the Listing record and its associated images from storage as a single atomic operation, and IF any part of the removal fails, THEN THE Listing_Manager SHALL roll back the operation and leave the Listing and its images unchanged.
3. WHEN a Listing is deleted, THE Listing_Manager SHALL permanently remove the Listing from renter-facing discovery results and from all Listing_Workspace views, such that the Listing is no longer retrievable or restorable.
4. IF a Landlord requests to delete a Listing that has one or more Applications with status `submitted`, `under_review`, `shortlisted`, or `approved`, THEN THE Listing_Manager SHALL reject the deletion, leave the Listing, its images, and its Applications unchanged, and return a message stating that active applicants prevent deletion.
5. IF a Landlord requests to delete or archive a Listing that is not owned by that Landlord, THEN THE Listing_Manager SHALL evaluate ownership before any other condition and SHALL reject the request with an access-denied error regardless of whether the Listing has active Applications.
6. IF a Landlord cancels or dismisses the deletion confirmation, THEN THE Listing_Manager SHALL leave the Listing, its images, and its Applications unchanged.

### Requirement 6: Listing Duplication

**User Story:** As a Landlord, I want to duplicate an existing listing, so that I can create a similar listing for another unit without re-entering all fields.

#### Acceptance Criteria

1. WHEN a Landlord requests to duplicate a Listing owned by that Landlord, THE Listing_Manager SHALL create a new Listing with status `draft` that copies the source Listing's field values, amenity selections, and image set.
2. WHEN the Listing_Manager duplicates a Listing, THE Listing_Manager SHALL assign the new Listing to the requesting Landlord.
3. WHEN the Listing_Manager duplicates a Listing, THE Listing_Manager SHALL create the new Listing with zero Applications and zero viewing records, and SHALL leave the source Listing's Applications and viewing records unchanged.
4. WHEN the Listing_Manager creates a duplicated Listing, THE Listing_Manager SHALL set a title that contains the full source Listing title together with an added copy indicator and that is not identical to the source Listing title.
5. IF a Landlord requests to duplicate a Listing that is not owned by that Landlord, THEN THE Listing_Manager SHALL evaluate ownership before any other condition, create no Listing, and reject the request with an access-denied error.

### Requirement 7: Listing Organization and Search

**User Story:** As a Landlord with many listings, I want to search, filter, and sort my listings, so that I can quickly find the listing I need to manage.

#### Acceptance Criteria

1. WHEN a Landlord enters a search term of up to 100 characters, THE Listing_Workspace SHALL trim leading and trailing whitespace from the term and display only the Landlord's Listings whose title or address contains the trimmed term, matched without case sensitivity.
2. WHEN a Landlord filters Listings by a status of `draft`, `published`, or `archived`, THE Listing_Workspace SHALL display only the Landlord's Listings with the selected status.
3. WHEN a Landlord sorts Listings by most recently updated, THE Listing_Workspace SHALL order the displayed Listings from most recently updated to least recently updated.
4. WHEN a Landlord sorts Listings by applicant count, THE Listing_Workspace SHALL order the displayed Listings from highest applicant count to lowest applicant count.
5. WHEN a Landlord applies a sort while another sort is already active, THE Listing_Workspace SHALL treat the most recently selected sort as the primary order and SHALL apply previously selected sorts as secondary tie-breakers.
6. IF the active search term and status filter together match no Listings, THEN THE Listing_Workspace SHALL display an empty-state message indicating that no Listings match the current search and filter criteria.
7. WHEN a Landlord has an active search term and status filter, THE Listing_Workspace SHALL apply the search term and status filter cumulatively and order the resulting Listings by the active sort.
8. WHEN a Landlord's search term is empty or contains only whitespace, THE Listing_Workspace SHALL display all of the Landlord's Listings that match the active status filter.

### Requirement 8: Listing Performance Insights

**User Story:** As a Landlord, I want to see performance metrics for each listing, so that I can understand which listings are attracting applicants and act accordingly.

#### Acceptance Criteria

1. WHEN a Landlord views a Listing owned by that Landlord in the Listing_Workspace, THE Listing_Insights SHALL display the total number of Applications received for that Listing as a non-negative integer.
2. WHEN a Landlord views a Listing owned by that Landlord in the Listing_Workspace, THE Listing_Insights SHALL display the count of Applications for that Listing grouped by each Application status (`submitted`, `under_review`, `shortlisted`, `approved`, `rejected`, `withdrawn`), showing a zero value for any status that has no Applications.
3. WHEN a Landlord views a Listing owned by that Landlord in the Listing_Workspace, THE Listing_Insights SHALL display the number of viewings scheduled for that Listing whose scheduled date and time is in the future and whose state is not cancelled.
4. WHERE a Published_Listing has received zero Applications, THE Listing_Insights SHALL display a zero value for that Listing's total Application count and for each Application status count.
5. THE Listing_Insights SHALL compute metrics only from Applications and viewings belonging to Listings owned by the requesting Landlord.
6. IF a Landlord requests Listing_Insights for a Listing not owned by that Landlord, THEN THE Listing_Insights SHALL withhold all metrics for that Listing and return an access-denied error.
7. IF the Listing_Insights cannot retrieve the Application or viewing data required to compute metrics, THEN THE Listing_Insights SHALL return an error indicating metrics are temporarily unavailable and SHALL NOT display partial or previously cached counts.

### Requirement 9: Consolidated Applicant Management

**User Story:** As a Landlord, I want to review and decide on applicants across all of my listings from one place, so that I can manage incoming demand efficiently.

#### Acceptance Criteria

1. WHEN a Landlord opens the Applicants view, THE Applicant_Manager SHALL display Applications across all Listings owned by the Landlord, grouped by Application status and ordered within each group by submission time from most recent to least recent.
2. WHEN a Landlord selects an Application, THE Applicant_Manager SHALL display the applicant's submitted details and the list of documents the applicant uploaded.
3. WHEN a Landlord changes an Application to a status that is a permitted transition from its current status, THE Applicant_Manager SHALL update and persist the Application's new status.
4. IF a Landlord requests a status change for an Application that is in a terminal status (`rejected` or `withdrawn`) or that is not a permitted transition, THEN THE Applicant_Manager SHALL reject the change, leave the Application's current status unchanged, and return a message describing the reason.
5. WHEN an Application status is changed by a Landlord, THE Applicant_Manager SHALL record the change, including the time of the change, the previous status, and the new status, so that the Renter can be notified of the updated status.
6. IF a Landlord requests Applications for a Listing not owned by that Landlord, THEN THE Applicant_Manager SHALL return no Applications for that Listing and SHALL record a log entry of the unauthorized access attempt that includes the time of the attempt and the requesting Landlord's identity.
7. WHEN a Landlord opens the Applicants view and owns no Applications across any Listing, THE Applicant_Manager SHALL display an empty-state message indicating that there are no applications.
8. IF the Applicant_Manager cannot retrieve an Application's details or documents, THEN THE Applicant_Manager SHALL return an error indicating the details are temporarily unavailable and SHALL provide a means to retry.

### Requirement 10: Landlord Viewing Scheduling

**User Story:** As a Landlord, I want to propose and track viewing times for applicants, so that I can coordinate property viewings with control over my availability.

#### Acceptance Criteria

1. WHEN a Landlord proposes one or more viewing slots, each having a start time and an end time, for an Application on a Listing owned by that Landlord, THE Viewing_Scheduler SHALL record the proposed slots and associate them with the Application.
2. WHEN a Renter books a proposed viewing slot that is not already booked, THE Viewing_Scheduler SHALL mark that slot as booked and prevent any other Renter from booking the same slot.
3. WHEN a Landlord views the Viewings view, THE Viewing_Scheduler SHALL display the Landlord's proposed and booked viewings with their associated Listing and applicant, and IF the Landlord has no viewings, THEN THE Viewing_Scheduler SHALL display an empty-state message indicating there are no viewings.
4. IF the requesting user is not the owning Landlord of the associated Listings, THEN THE Viewing_Scheduler SHALL withhold the viewing records and return an access-denied error.
5. IF a Landlord proposes a viewing slot whose start time is at or before the current time, THEN THE Viewing_Scheduler SHALL reject the proposed slot and return a validation error.
6. IF a Landlord proposes a viewing slot for an Application on a Listing not owned by that Landlord, THEN THE Viewing_Scheduler SHALL reject the request and return an access-denied error.
7. IF a Renter requests to book a viewing slot that is already booked, THEN THE Viewing_Scheduler SHALL reject the request and return a message indicating the slot is no longer available.
8. IF a Landlord proposes a viewing slot whose end time is at or before its start time, THEN THE Viewing_Scheduler SHALL reject the proposed slot and return a validation error.
