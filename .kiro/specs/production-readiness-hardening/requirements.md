# Requirements Document

## Introduction

This document specifies the requirements for a repo-wide **Production Readiness & Launch Hardening** initiative for **RoomZA**, a map-first rental marketplace for South African users. The initiative takes the existing application from its current state to genuinely launch-ready for real users.

This is a hardening and completion pass, **not** a redesign. The map-first experience, bento-grid layouts, Google Maps surface, OKLCH brand colours, and the minimal, deliberate interface are preserved exactly. The work is organised into nine sequential phases, each scoped to a distinct concern: audit, architecture, flow completion, UX polish, performance, security, database, testing, and a final production-readiness exit gate.

Four existing specs — `conversation-video-calling`, `discovery-pop`, `landlord-listing-management`, and `mobile-map-discovery` — represent in-progress feature areas. This initiative **validates and completes** those areas against the readiness bar rather than re-specifying them from scratch.

Each requirement is expressed as testable EARS acceptance criteria so that implementation can proceed in a sequenced, reviewable manner. The phases are ordered so that audit findings (Phase 1) feed all later phases, and the exit gate (Phase 9) verifies the cumulative result.

## Glossary

- **Readiness_Audit**: The process and its tooling that compares the implemented codebase against the README and produces a structured gap-analysis report.
- **Gap_Report**: The structured artefact listing every discovered gap (missing feature, broken flow, dead code, half-implemented component, placeholder page, missing validation, missing API route, missing state, missing observability), each with a severity and a source location.
- **Architecture_Review**: The process and checks that validate the codebase against the project's feature-first architecture rules.
- **Auth_System**: The authentication and session-management subsystem (Supabase Auth, session helpers, middleware, protected-route guards, redirect logic).
- **Landlord_Workspace**: The landlord-facing application surfaces under `/dashboard`, including listing management, applicant management, viewings, messaging, notifications, and profile.
- **Renter_Workspace**: The renter-facing application surfaces, including map discovery, listing detail, saved listings, applications, viewings, messaging, notifications, and profile.
- **Map_Discovery**: The map-first discovery surface built on Google Maps (`@vis.gl/react-google-maps`), including markers, viewport queries, filters, detail panel, and the mobile bottom-sheet shell.
- **Listing_Service**: The listing domain module covering CRUD, schema/validation, image upload, location picking, amenities, true-cost calculation, and publish/unpublish.
- **Application_Service**: The application domain module covering the submitted → reviewing → approved/rejected state machine, document upload, and withdraw.
- **Viewing_Service**: The viewing domain module covering slot proposal, slot validation, and live video viewings.
- **Messaging_Service**: The real-time chat subsystem built on Supabase Realtime, including conversation threads and message delivery.
- **Video_Service**: The Jitsi Meet embedded video-calling subsystem and conversation-level call-state management.
- **Notification_Service**: The notification outbox, QStash background delivery, and Resend email delivery subsystem.
- **UI_System**: The presentation layer — components, layouts, navigation, loading/empty/error states, animations, and responsive behaviour.
- **Performance_Layer**: The rendering, caching, code-splitting, image-optimisation, and data-access concerns affecting runtime performance.
- **Security_Layer**: The cross-cutting security controls — RLS, authz, API validation, rate limiting, input sanitisation, security headers, secrets, and storage permissions.
- **Database_Layer**: The Supabase PostgreSQL schema, migrations, indexes, constraints, foreign keys, RLS policies, triggers, and functions.
- **Test_Suite**: The combined unit, integration, end-to-end (Playwright), database (SQL), and property-based (fast-check) tests.
- **Release_Gate**: The final production-readiness exit check that aggregates all blocking criteria into a single pass/fail verdict.
- **Blocking_Issue**: Any TypeScript error, ESLint error, failing test, runtime console error, hydration mismatch, placeholder/mock artefact, or unresolved TODO that prevents launch.
- **Critical_User_Journey**: An end-to-end path a real user must complete (e.g., renter signs up → searches map → applies → schedules viewing; landlord signs up → creates listing → reviews applicant → approves).
- **In_Progress_Spec**: One of the four existing specs (`conversation-video-calling`, `discovery-pop`, `landlord-listing-management`, `mobile-map-discovery`).

## Requirements

### Requirement 1: Deep Repository Audit & Gap Analysis

**User Story:** As the project owner, I want a deep audit of the implemented code against the documented product, so that I have a complete, prioritised inventory of what must be completed before launch.

#### Acceptance Criteria

1. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL produce a Gap_Report containing one entry for every feature described in the README, where each entry records the feature name, the README reference (section heading or line number), and either its implementation file path(s) or a status of "missing".
2. WHEN a feature described in the README has no corresponding implementation file, THE Readiness_Audit SHALL record the feature in the Gap_Report with category "missing-feature" and the README reference (section heading or line number).
3. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL record in the Gap_Report, with file path, every page that renders placeholder content, every component containing an unimplemented code path (TODO/FIXME marker, not-implemented throw, or commented-out logic), and every data source returning mock or hardcoded sample data.
4. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL record in the Gap_Report, with file path, every reachable application route that lacks a defined loading state, empty state, or error state, identifying which of the three states is absent.
5. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL record in the Gap_Report, with file path, every API route, Server Action, and form submission that accepts input and lacks input validation on at least one input field.
6. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL record in the Gap_Report, with file path, every user-facing action and API route that lacks analytics instrumentation, structured logging, or monitoring coverage, identifying which of the three is absent.
7. WHERE the codebase contains code that is unreachable from any application entry point or unreferenced by any module, THE Readiness_Audit SHALL record each occurrence in the Gap_Report with category "dead-code" and its file path.
8. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL assign each Gap_Report entry exactly one severity from the set {blocker, major, minor} and exactly one owning phase identified by its Requirement number in the range Requirement 2 through Requirement 8.
9. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL record in the Gap_Report, for each In_Progress_Spec, every remaining incomplete task required for that In_Progress_Spec to reach the readiness bar.
10. IF the Readiness_Audit cannot analyze a reachable route or source file, THEN THE Readiness_Audit SHALL record the item in the Gap_Report with category "audit-incomplete", its file path, and an indication of the reason it could not be analyzed.

### Requirement 2: Architecture Validation

**User Story:** As an engineer, I want the codebase to conform to the feature-first architecture and strict TypeScript rules, so that the application is maintainable and free of duplicated business logic.

#### Acceptance Criteria

1. WHEN the Architecture_Review scans the codebase, THE Architecture_Review SHALL verify that every module containing domain logic resides under a `src/features/<domain>` path, and for each domain-logic module located outside `src/features/<domain>` THE Architecture_Review SHALL record one violation in the Gap_Report identifying the file path and the misplaced logic.
2. WHERE a component performs no client-only behaviour (defined as: React state, lifecycle or `useEffect` effects, browser/Web APIs, or DOM event handlers), THE Architecture_Review SHALL require that component to be a React Server Component, and SHALL record in the Gap_Report one violation for each such component that declares a `"use client"` directive, identifying the file path.
3. WHEN the Architecture_Review scans UI components, THE Architecture_Review SHALL verify that business logic is expressed in reusable hooks, services, or schemas, and SHALL record in the Gap_Report one violation for each instance of business logic that is duplicated (identical or semantically equivalent logic appearing in 2 or more locations) inside UI components, identifying each location.
4. WHEN the Architecture_Review scans validation schemas and shared types, THE Architecture_Review SHALL verify that each validation schema and each shared type is defined exactly once and imported where needed, and SHALL record in the Gap_Report one violation for each schema or type whose definition appears in 2 or more locations, identifying each duplicate location.
5. IF the codebase contains an occurrence of the TypeScript `any` type, AND that occurrence is not immediately preceded by an inline annotation comment stating the justification for the exception, THEN THE Architecture_Review SHALL record in the Gap_Report one violation for that occurrence, identifying the file path and line.
6. WHEN the Architecture_Review inspects the TypeScript configuration, THE Architecture_Review SHALL verify that strict mode and every constituent strictness flag are enabled, and SHALL record in the Gap_Report one violation for each strictness flag that is disabled, identifying the flag name.
7. WHEN the Architecture_Review completes, THE Architecture_Review SHALL produce the list of recorded violations, and THE Architecture_Review SHALL be considered complete for this phase only IF that list contains zero violations.

### Requirement 3: Complete Authentication Flows End-to-End

**User Story:** As a user, I want every authentication action to work reliably, so that I can securely access the role-appropriate parts of the application.

#### Acceptance Criteria

1. WHEN a visitor submits valid signup details, THE Auth_System SHALL create an account and send an email-verification message via the Notification_Service within 60 seconds.
2. WHEN a user submits valid login credentials, THE Auth_System SHALL establish an authenticated session and redirect the user to the role-appropriate home route within 2 seconds.
3. IF a user submits invalid login credentials, THEN THE Auth_System SHALL deny access, display a non-enumerating error message, and after 5 consecutive failed attempts SHALL lock the account for at least 15 minutes.
4. WHEN an authenticated user logs out, THE Auth_System SHALL terminate the session and redirect the user to the public landing route within 2 seconds.
5. WHEN a user requests a password reset, THE Auth_System SHALL send a password-reset email via the Notification_Service within 60 seconds using a non-enumerating response (the same response whether or not the email exists), and the reset token SHALL be valid for 60 minutes.
6. WHEN a user completes the password-reset flow with a valid token, THE Auth_System SHALL update the password and invalidate the reset token.
7. WHEN a user authenticates via an OAuth provider, THE Auth_System SHALL complete the OAuth callback, establish an authenticated session, and redirect the user within 2 seconds.
8. WHEN a user verifies their email via a valid verification link, THE Auth_System SHALL mark the account as verified, where the verification link is valid for 24 hours.
9. WHEN a newly verified user has no assigned role, THE Auth_System SHALL route the user to the role-selection onboarding flow before granting access to role-specific surfaces.
10. WHILE a session is valid but its access token is within 60 seconds of expiry, THE Auth_System SHALL refresh the session without interrupting the user's current action.
11. IF an unauthenticated user requests a protected route, THEN THE Auth_System SHALL redirect the user to the login route and SHALL return the user to the originally requested route after successful authentication.
12. WHERE the user selects "remember me" at login, THE Auth_System SHALL persist the session across browser restarts for 30 days.
13. IF a user submits the password-reset flow with an invalid or expired token, THEN THE Auth_System SHALL reject the reset and display an error without changing the password.
14. IF an OAuth authentication fails or the callback returns an error, THEN THE Auth_System SHALL deny access, display an error, and return the user to the login route.
15. IF a user opens an invalid or expired email-verification link, THEN THE Auth_System SHALL reject verification and offer to resend a verification message.

### Requirement 4: Complete Landlord Flows End-to-End

**User Story:** As a landlord, I want every workspace action to work end-to-end, so that I can list properties and manage applicants without encountering broken or incomplete features.

#### Acceptance Criteria

1. WHEN a landlord submits a valid new-listing form, THE Listing_Service SHALL create the listing and confirm creation to the landlord within 3 seconds.
2. WHEN a landlord submits an invalid new-listing form, THE Listing_Service SHALL reject the submission, indicate the invalid fields, and retain the entered values.
3. WHEN a landlord edits a listing they own, THE Listing_Service SHALL persist the changes and confirm the update within 3 seconds.
4. WHEN a landlord deletes a listing they own, THE Listing_Service SHALL remove the listing and confirm the deletion within 3 seconds.
5. WHEN a landlord uploads between 1 and 20 listing images, each no larger than 10 MB and in JPEG, PNG, or WebP format, THE Listing_Service SHALL store the images and associate them with the listing.
6. IF a landlord uploads images that exceed 20 in count, exceed 10 MB each, or are not in JPEG, PNG, or WebP format, THEN THE Listing_Service SHALL reject the upload and indicate the violated bound.
7. WHEN a landlord publishes or unpublishes a listing, THE Listing_Service SHALL update the listing visibility accordingly.
8. THE Landlord_Workspace SHALL display the applicants associated with each of the landlord's listings.
9. WHEN a landlord approves an applicant, THE Application_Service SHALL transition the application to the "approved" state and notify the renter via the Notification_Service.
10. WHEN a landlord rejects an applicant, THE Application_Service SHALL transition the application to the "rejected" state and notify the renter via the Notification_Service.
11. WHEN a landlord proposes a viewing slot, THE Viewing_Service SHALL record the proposed slot and notify the renter via the Notification_Service.
12. WHEN a landlord joins a scheduled video viewing, THE Video_Service SHALL connect the landlord to the conversation's video session.
13. WHEN a landlord sends a message in a conversation, THE Messaging_Service SHALL deliver the message to the renter within 2 seconds.
14. WHEN a landlord opens the dashboard, THE Landlord_Workspace SHALL display dashboard analytics for the landlord's listings, including listing views and applicant counts.
15. WHEN a landlord updates their profile, THE Landlord_Workspace SHALL persist the changes and confirm the update within 3 seconds.
16. IF a landlord attempts an action on a listing or applicant they do not own, THEN THE Security_Layer SHALL deny the action with no change to the resource and an authorization-denied indication.

### Requirement 5: Complete Renter Flows End-to-End

**User Story:** As a renter, I want every discovery and application action to work end-to-end, so that I can find a home and apply without encountering broken or incomplete features.

#### Acceptance Criteria

1. THE Map_Discovery SHALL display published listings as price-pin markers within the current map viewport, and SHALL cluster markers when more than 200 markers fall within the viewport.
2. WHEN a renter pans or zooms the map, THE Map_Discovery SHALL query and display the listings within the updated viewport within 2 seconds.
3. WHEN a renter applies search filters, THE Map_Discovery SHALL display only the listings that satisfy the active filters.
4. WHEN a renter selects a listing, THE Renter_Workspace SHALL display the listing detail surface for that listing within 2 seconds.
5. WHEN a renter saves or unsaves a listing, THE Renter_Workspace SHALL persist the favourite state and reflect it in the saved-listings surface within 2 seconds.
6. WHEN a renter submits a valid application (defined as all required fields populated and passing field-level validation), THE Application_Service SHALL create the application in the "submitted" state, notify the landlord via the Notification_Service, and confirm submission within 5 seconds.
7. IF a renter submits an invalid application, THEN THE Application_Service SHALL reject the submission, retain the entered data, and indicate the invalid fields.
8. WHEN a renter uploads application documents, each no larger than 10 MB and no more than 20 per application, THE Application_Service SHALL store the documents and associate them with the application.
9. IF a document upload fails or exceeds 10 MB, THEN THE Application_Service SHALL reject the upload and indicate the failure.
10. WHEN a renter withdraws an application, THE Application_Service SHALL transition the application to the withdrawn state.
11. THE Renter_Workspace SHALL display the status of each of the renter's applications.
12. WHEN a renter accepts a proposed viewing slot, THE Viewing_Service SHALL confirm the viewing and notify the landlord via the Notification_Service.
13. WHEN a renter joins a scheduled video viewing, THE Video_Service SHALL connect the renter to the conversation's video session within 10 seconds.
14. IF a video connection fails, THEN THE Video_Service SHALL indicate the failure and offer a retry.
15. WHEN a renter sends a message in a conversation, THE Messaging_Service SHALL deliver the message to the landlord within 2 seconds and SHALL provide a delivery-failure indicator if delivery does not succeed.
16. WHEN a renter updates their profile, THE Renter_Workspace SHALL persist the changes and confirm the update within 2 seconds.

### Requirement 6: UX Polish (Improve, Not Redesign)

**User Story:** As a user, I want a consistent, responsive, and accessible interface, so that the application feels finished and is usable on any device, while keeping the existing map-first design.

#### Acceptance Criteria

1. THE UI_System SHALL preserve the existing map-first layout, bento-grid structure, Google Maps surface, and OKLCH brand colours without redesigning them.
2. WHILE a data-dependent view has been loading for at least 100ms, THE UI_System SHALL display a loading skeleton whose dimensions match the eventual content within ±10%.
3. WHEN a data-dependent view resolves with no results, THE UI_System SHALL display an empty state containing a descriptive message and at least one actionable control.
4. IF a data-dependent view fails to load, THEN THE UI_System SHALL display an error state with an error indication and a retry control, leaving any prior data unchanged until a retry succeeds.
5. WHEN a user activates the retry control, THE UI_System SHALL re-initiate the load and clear the error indication on success.
6. THE UI_System SHALL apply spacing, typographic hierarchy, and component styling drawn from the existing design token set across every reachable route.
7. THE UI_System SHALL render every reachable route at viewport widths of 360px, 768px, and 1280px with no horizontal scrollbar, no content overflow, and no overlapping content.
8. THE UI_System SHALL provide a logical keyboard focus order matching reading order and a visible focus indicator with at least 3:1 contrast for every interactive element on each reachable route.
9. THE UI_System SHALL meet WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text and interactive elements) in both light mode and dark mode.
10. WHEN a user toggles between light mode and dark mode, THE UI_System SHALL apply the selected theme across every reachable route within 300ms.
11. WHEN a user interacts with a control that triggers a state change, THE UI_System SHALL provide a transition or micro-interaction lasting no longer than 300ms without blocking further input.
12. THE UI_System SHALL support touch interactions on the map and the mobile bottom sheet, including drag-to-expand and drag-to-dismiss past a 25% drag threshold.
13. THE UI_System SHALL provide touch targets of at least 44x44 CSS pixels for interactive controls at mobile viewport widths.

Note: Full WCAG 2.1 AA conformance requires manual testing with assistive technologies and expert accessibility review beyond the automated checks described above.

### Requirement 7: Performance

**User Story:** As a user on a typical South African mobile connection, I want pages to load and respond quickly, so that discovery and application feel smooth.

#### Acceptance Criteria

1. WHERE a route can be server-rendered, THE Performance_Layer SHALL render that route on the server and SHALL keep the client-side JavaScript shipped to the browser within the project's configured first-load client JavaScript budget.
2. THE Performance_Layer SHALL serve listing images in an optimised format and at dimensions matched to the rendering viewport.
3. THE Performance_Layer SHALL apply code splitting and dynamic imports so that heavy client modules (map, video, charts) are loaded only when required.
4. WHEN a viewport listing query is issued, THE Database_Layer SHALL return results using an index that covers the spatial query.
5. THE Performance_Layer SHALL use Suspense streaming so that primary content becomes interactive before all secondary content has loaded.
6. WHEN a user navigates to a likely-next route, THE Performance_Layer SHALL prefetch that route's resources.
7. THE Performance_Layer SHALL apply caching to repeatable read queries so that identical requests within the project's configured cache window do not re-query the database.
8. WHEN the production bundle is built, THE Performance_Layer SHALL keep each route's first-load client JavaScript within the project's configured budget.
9. IF a route configured for server rendering fails to render on the server, THEN THE Performance_Layer SHALL serve a defined fallback and record the failure.
10. IF the spatial index is unavailable for a viewport query, THEN THE Database_Layer SHALL still return correct results and record the missing-index condition.

### Requirement 8: Security

**User Story:** As the project owner, I want every security control verified and enforced, so that real user data is protected at launch.

#### Acceptance Criteria

1. THE Database_Layer SHALL enforce Row Level Security on every table containing user or listing data, such that a query issued without an authenticated context returns zero rows.
2. WHEN an API route or Server Action receives input, THE Security_Layer SHALL validate the input against a Zod schema before processing.
3. IF input fails Zod validation, THEN THE Security_Layer SHALL reject the request, preserve the submitted data, and indicate the invalid input.
4. IF an authenticated user requests a resource they are not authorised to access, THEN THE Security_Layer SHALL deny the request, returning no resource data and a not-authorised indication.
5. THE Security_Layer SHALL apply rate limiting of 10 requests per 60 seconds to authentication API routes and 60 requests per 60 seconds to mutation API routes.
6. IF a client exceeds the configured rate limit, THEN THE Security_Layer SHALL reject the request with a rate-limit indication.
7. THE Security_Layer SHALL sanitise user-supplied content before rendering it, such that no user-supplied script executes in the rendered output.
8. THE Security_Layer SHALL enforce a Content-Security-Policy and HSTS response headers on every served route.
9. WHEN a user uploads a file, THE Security_Layer SHALL validate the file type and reject any file larger than 10 MB or of a disallowed type, and SHALL store accepted files under storage permissions that restrict access to authorised users.
10. THE Security_Layer SHALL load all secrets from validated environment variables and SHALL exclude secrets from client bundles and logs.
11. WHEN a security-relevant action occurs (login, role change, application decision, listing deletion), THE Security_Layer SHALL record an audit-trail entry through structured logging capturing the actor, the action type, and the timestamp.

### Requirement 9: Database Integrity

**User Story:** As an engineer, I want the database schema reviewed and corrected, so that data is consistent, queries are performant, and policies are correct.

#### Acceptance Criteria

1. THE Database_Layer SHALL define a foreign key for every inter-table relationship.
2. IF an inter-table relationship lacks a foreign key, THEN THE Database_Layer SHALL record it as a Gap_Report entry.
3. THE Database_Layer SHALL define indexes covering the columns appearing in WHERE, JOIN, and ORDER BY clauses, and SHALL define spatial indexes on PostGIS geometry and geography columns used by spatial queries.
4. THE Database_Layer SHALL define constraints (not-null, unique, check) that enforce the documented data invariants.
5. WHEN a constraint is violated, THE Database_Layer SHALL reject the write, preserving the existing state and indicating the violation.
6. THE Database_Layer SHALL define RLS policies that grant access only to authorised roles for select, insert, update, and delete on each table.
7. WHEN an unauthorized role attempts access, THE Database_Layer SHALL deny the access through RLS, preserving the existing state.
8. THE Database_Layer SHALL conform to a single documented naming convention for tables, columns, indexes, functions, and policies.
9. WHERE a migration defines a trigger or function, THE Database_Layer SHALL declare its security context (invoker or definer) explicitly.
10. WHEN all migrations are applied in sequence to a fresh database, THE Database_Layer SHALL apply without error and SHALL pass 100% of the RLS test plan cases.

### Requirement 10: Testing Coverage

**User Story:** As an engineer, I want comprehensive automated tests, so that critical journeys are protected against regression before and after launch.

#### Acceptance Criteria

1. THE Test_Suite SHALL include at least one unit test for each validation schema, each state transition, and each pure domain function, such that 100% of these items have associated test coverage.
2. THE Test_Suite SHALL include integration tests for the application, listing, chat, viewing, and notification workflows, with at least one test per workflow exercising a successful path and at least one test per workflow exercising a failure path.
3. THE Test_Suite SHALL include Playwright end-to-end tests covering 100% of Critical_User_Journey items, with at least one test per Critical_User_Journey.
4. THE Test_Suite SHALL include database tests that verify, for each table, that the RLS policies grant access to authorized roles and deny access to unauthorized roles.
5. THE Test_Suite SHALL include property-based tests for each parser and each serializer, and each such test SHALL assert a round-trip property (parse → print → parse produces an equivalent value) over at least 100 generated inputs.
6. THE Test_Suite SHALL include at least one regression test for each Blocking_Issue resolved during this initiative.
7. WHEN the Test_Suite runs in the CI pipeline, THE Test_Suite SHALL report the count of failing tests before the Release_Gate is evaluated.
8. IF the Test_Suite reports one or more failing tests when the Release_Gate is evaluated, THEN THE Release_Gate SHALL block the release and indicate that the test stage failed.
9. IF an individual test does not complete within 120 seconds, THEN THE Test_Suite SHALL terminate that test and record it as a failure.

### Requirement 11: Production Readiness Exit Gate

**User Story:** As the project owner, I want a single, objective gate that confirms launch readiness, so that the application ships only when every blocking criterion is satisfied.

#### Acceptance Criteria

1. WHEN the Release_Gate is evaluated, THE Release_Gate SHALL report zero TypeScript errors.
2. WHEN the Release_Gate is evaluated, THE Release_Gate SHALL report zero ESLint errors.
3. WHEN the Release_Gate is evaluated, THE Release_Gate SHALL report zero failing tests across the Test_Suite.
4. WHEN a Critical_User_Journey is exercised, THE Release_Gate SHALL confirm zero error-level console messages and zero hydration mismatch warnings.
5. THE Release_Gate SHALL confirm that no reachable route (defined as a route navigable from an entry point via visible controls) contains placeholder content, mock data, or fake API responses.
6. THE Release_Gate SHALL confirm that the codebase contains no unresolved TODO markers in shipping code paths.
7. THE Release_Gate SHALL confirm that every reachable route is accessible and that no navigation link resolves to a missing route.
8. WHEN a Critical_User_Journey is exercised for 10 consecutive iterations, THE Release_Gate SHALL confirm no duplicated network requests (defined as more than one identical request per iteration for the same resource), no race conditions in state updates, and no memory leaks (verified by the listener and subscription count returning to its pre-journey baseline).
9. IF any Blocking_Issue remains unresolved, THEN THE Release_Gate SHALL report a failed verdict and SHALL enumerate each unresolved Blocking_Issue with its originating criterion, retaining the findings unmodified.
10. WHEN every blocking criterion is satisfied, THE Release_Gate SHALL report a passed verdict.

### Requirement 12: Validation and Completion of In-Progress Specs

**User Story:** As the project owner, I want the four in-progress specs validated and completed rather than re-specified, so that their feature areas reach the same readiness bar as the rest of the application.

#### Acceptance Criteria

1. WHEN the Readiness_Audit executes, THE Readiness_Audit SHALL record, for each In_Progress_Spec, a pass or fail result against its own tasks and against each applicable criterion in Requirements 3 through 11.
2. IF an In_Progress_Spec has an incomplete task that is required for launch (referenced by a Requirement 3–11 criterion or a Critical_User_Journey), THEN THE Readiness_Audit SHALL record that task in the Gap_Report and assign it exactly one owning phase.
3. IF an In_Progress_Spec cannot be evaluated because its tasks list is missing or unreadable, THEN THE Readiness_Audit SHALL record the spec in the Gap_Report with category "audit-incomplete" and SHALL NOT mark the spec as passed.
4. THE Readiness_Audit SHALL reference the existing acceptance criteria of each In_Progress_Spec by identifier and SHALL NOT create, duplicate, or replace them.
5. WHEN an In_Progress_Spec feature area is exercised as part of a Critical_User_Journey, THE Release_Gate SHALL apply the same exit criteria defined in Requirement 11 with no exemption based on in-progress status.
