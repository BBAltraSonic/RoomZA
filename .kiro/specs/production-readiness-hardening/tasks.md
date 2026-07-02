# Implementation Plan: Production Readiness & Launch Hardening

## Overview

This plan implements the nine-phase hardening pipeline defined in the design. It is ordered so dependencies are satisfied: Phase 1 builds the audit tooling and emits the living `Gap_Report` that scopes every later phase; Phases 2–9 close the gaps they own on the existing `client → "use server" action → Supabase SSR → Postgres RPC/RLS` chain; Phase 10 completes the test suite; and the Release Gate runs last, independently re-deriving the launch verdict from the current codebase.

All work is in TypeScript on the existing stack (Next.js 16 App Router/RSC, React 19, Vitest 4 + fast-check 4, Playwright, Supabase/PostGIS, Cloudflare Workers via OpenNext). Property tests use **fast-check with `numRuns: 100`** minimum and are tagged `// Feature: production-readiness-hardening, Property {n}`. This is a hardening and completion pass — the map-first surface, bento grids, Google Maps, and OKLCH tokens are preserved (R6.1).

## Tasks

- [x] 1. Implement Gap_Report data models and invariants (`scripts/audit/schema.ts`)
  - [x] 1.1 Define the `GapEntry`, `SpecResult`, and supporting `Severity`/`OwningPhase`/`GapCategory` Zod schemas
    - Implement the schemas exactly as in the design Data Models section, with refinements enforcing the invariants: non-`audit-incomplete` entries have exactly one severity and one `owningPhase` in 2–8; `missing-feature` entries have a non-null `readmeRef` and empty `filePaths`; `missing-route-state` entries have a non-null `missingState`; `missing-observability` entries name the absent item; `audit-incomplete` entries have a non-null `reason`; specs with `tasksFileFound === false` have `passed === false`
    - Export a stable `gapEntryId(...)` hash helper over `{category, filePath, detail}`
    - _Requirements: 1.1, 1.2, 1.4, 1.6, 1.8, 1.10, 12.3_
    - _Design: Readiness_Audit, Gap_Report entry schema, In-progress spec result schema_

  - [x] 1.2 Write property test for Gap_Report classification invariants
    - **Property 1: Gap_Report entries are well-formed and fully classified**
    - fast-check, `numRuns: 100`; generate arbitrary entries and assert every non-`audit-incomplete` entry has exactly one severity and one owning phase 2–8, and every `audit-incomplete` entry has a non-null reason
    - **Validates: Requirements 1.8, 1.10**

  - [x] 1.3 Write property test for missing-feature references
    - **Property 2: Missing-feature entries carry a README reference**
    - fast-check, `numRuns: 100`; assert every `missing-feature` entry has a non-null `readmeRef` and an empty `filePaths`
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.4 Write property test for absent-item identification
    - **Property 3: Route-state and observability gaps identify the absent item**
    - fast-check, `numRuns: 100`; assert every `missing-route-state` entry names exactly one of loading/empty/error and every `missing-observability` entry names exactly one of analytics/logging/monitoring
    - **Validates: Requirements 1.4, 1.6**

  - [x] 1.5 Write property test for unreadable-spec safety
    - **Property 4: A spec without a readable tasks list is never marked passed**
    - fast-check, `numRuns: 100`; assert that whenever `tasksFileFound === false`, `passed === false`
    - **Validates: Requirements 12.3**

- [x] 2. Implement severity and owning-phase assignment (`scripts/audit/severity.ts`)
  - [x] 2.1 Implement the deterministic assignment rules
    - Map each `GapCategory`/detail to exactly one `severity ∈ {blocker, major, minor}` and exactly one `owningPhase ∈ {2..8}` (e.g. missing-validation → blocker/phase 8; missing-route-state → major/phase 6; dead-code → minor/phase 2; db-integrity FK → blocker/phase 9), and assign `owningPhase: null` only for `audit-incomplete`
    - _Requirements: 1.8_
    - _Design: Severity & owning-phase assignment_

  - [x] 2.2 Write unit tests for severity rules
    - Cover one example per category, asserting a single severity and a single valid owning phase (or null for audit-incomplete)
    - _Requirements: 1.8_

- [x] 3. Implement the audit collectors (`scripts/audit/collectors/*`)
  - [x] 3.1 Implement `readme-features.ts`
    - Parse README feature sections, resolve each to implementation file path(s) or `"missing"`, recording the README section heading/line reference per entry
    - _Requirements: 1.1, 1.2_
    - _Design: Readiness_Audit collectors_

  - [x] 3.2 Implement `placeholders.ts`
    - Detect TODO/FIXME markers, `throw new Error("not implemented")`, commented-out logic, and mock/hardcoded sample data; record file path
    - _Requirements: 1.3_

  - [x] 3.3 Implement `route-states.ts`
    - Enumerate reachable routes under `src/app`; for each, detect missing loading/empty/error states (boundary file or in-component equivalent) and record which of the three is absent
    - _Requirements: 1.4_

  - [x] 3.4 Implement `input-validation.ts`
    - Find every API route, Server Action, and form accepting input that lacks Zod validation on ≥1 field; record file path
    - _Requirements: 1.5_

  - [x] 3.5 Implement `observability.ts`
    - Find user-facing actions/API routes lacking `logger` calls, analytics events, or monitoring; record which of the three is absent
    - _Requirements: 1.6_

  - [x] 3.6 Implement `dead-code.ts`
    - Build an import graph rooted at app entry points; flag unreferenced modules/exports with category `dead-code` and file path
    - _Requirements: 1.7_

  - [x] 3.7 Implement `architecture.ts`
    - Static checks for feature-first placement (R2.1), RSC-vs-client misuse (R2.2), duplicated schemas/types/logic (R2.3, R2.4), unjustified `any` (R2.5), and disabled strict TS flags by name (R2.6); emit `architecture` entries
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
    - _Design: Conformance-check architecture (Phase 2)_

  - [x] 3.8 Implement `db-integrity.ts`
    - Review the 27 migrations for missing FKs (R9.1, R9.2), missing indexes incl. PostGIS spatial (R9.3), missing constraints (R9.4), RLS policy gaps (R9.6), naming-convention deviations (R9.8), and missing explicit function/trigger security context (R9.9); emit `db-integrity` entries
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.8, 9.9_

  - [x] 3.9 Implement `in-progress-specs.ts`
    - For each of the four specs, read `tasks.md` if present and record remaining incomplete tasks plus a pass/fail against applicable R3–R11 criteria, assigning an owning phase to launch-required incomplete tasks; reference existing criteria by identifier only; record `audit-incomplete` (and never `passed`) when a tasks list is missing/unreadable
    - _Requirements: 1.9, 12.1, 12.2, 12.3, 12.4_
    - _Design: In-progress spec validation (R12)_

  - [x] 3.10 Write unit tests for collectors
    - Use fixture trees to assert each collector emits the expected entry shape, including the `audit-incomplete` self-report path (R1.10)
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.10_

- [x] 4. Implement the audit orchestrator and emit the Gap_Report (`scripts/audit/run-audit.ts`)
  - [x] 4.1 Implement `runAudit()` returning `AuditResult` and writing artefacts
    - Run all collectors, apply `severity.ts`, validate the result against the Zod schema, capture `generatedAt`/`commit`, compute the `byCategory`/`bySeverity`/`byOwningPhase` summary, and write `gap-report.json` (authoritative) plus a generated `gap-report.md` to `.kiro/specs/production-readiness-hardening/`
    - _Requirements: 1.1, 1.8, 1.9, 1.10_
    - _Design: Readiness_Audit interface, Gap_Report store_

  - [x] 4.2 Run the audit to produce the initial Gap_Report
    - Execute `run-audit.ts` against the current commit and commit the generated `gap-report.json` + `gap-report.md` as the seed artefact that scopes Phases 2–9
    - _Requirements: 1.1, 1.8_

  - [x] 4.3 Write unit test for summary aggregation
    - Assert the summary counts equal the entry counts grouped by category, severity, and owning phase
    - _Requirements: 1.8_

- [x] 5. Checkpoint - Phase 1 audit tooling complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Architecture validation (Phase 2)
  - [x] 6.1 Enable strict TypeScript flags in `tsconfig.json`
    - Explicitly enable `strict` plus every constituent flag (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `useUnknownInCatchVariables`, `alwaysStrict`) and `noUncheckedIndexedAccess`; fix resulting type errors
    - _Requirements: 2.6_
    - _Design: Conformance-check architecture, Strict TS_

  - [x] 6.2 Normalise viewing actions to the `ActionResult` union
    - Migrate viewing actions that return ad-hoc `{ error }`/`{ success }` to the shared `lib/action-result.ts` `ActionResult` contract without changing behaviour
    - _Requirements: 2.3_
    - _Design: Action-contract normalisation_

  - [x] 6.3 Resolve RSC-vs-client violations
    - Remove `"use client"` from components with no client-only behaviour flagged by the architecture collector
    - _Requirements: 2.2_

  - [x] 6.4 Resolve duplicated schemas, shared types, and business logic
    - Consolidate each duplicated validation schema/shared type to a single definition and extract duplicated UI business logic into shared hooks/services
    - _Requirements: 2.3, 2.4_

  - [x] 6.5 Resolve feature-first placement and unjustified `any` violations
    - Relocate domain logic found outside `src/features/<domain>` and add inline justification comments to (or remove) each unjustified `any`
    - _Requirements: 2.1, 2.5_

  - [x] 6.6 Re-run the architecture collector until the violations list is empty
    - Re-run `architecture.ts`; the phase is complete only when zero architecture violations remain
    - _Requirements: 2.7_

  - [x] 6.7 Write architecture conformance test
    - Add a test asserting the architecture collector returns zero violations against the current tree
    - _Requirements: 2.7_

- [x] 7. Checkpoint - Phase 2 architecture clean
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Complete authentication flows end-to-end (Phase 3)
  - [x] 8.1 Implement account lockout after 5 failed attempts for ≥15 minutes
    - Track consecutive failures and deny with a non-enumerating message during lockout
    - _Requirements: 3.3_
    - _Design: Auth_System (R3)_

  - [x] 8.2 Implement non-enumerating password reset with a 60-minute token
    - Same response whether or not the email exists; send reset email via Notification_Service within 60s; token valid 60 minutes; on valid token update password and invalidate token; reject invalid/expired tokens without changing the password
    - _Requirements: 3.5, 3.6, 3.13_

  - [x] 8.3 Implement "remember me" 30-day session persistence
    - Persist the session across browser restarts for 30 days when selected
    - _Requirements: 3.12_

  - [x] 8.4 Complete OAuth callback success and error paths
    - On success establish a session and redirect within 2s; on failure/callback error deny access, show an error, and return to the login route
    - _Requirements: 3.7, 3.14_

  - [x] 8.5 Complete email-verification valid and invalid/expired paths
    - Mark account verified on a valid 24-hour link; on invalid/expired link reject and offer to resend
    - _Requirements: 3.8, 3.15_

  - [x] 8.6 Implement role-selection onboarding routing
    - Route a newly verified user with no role to onboarding before any role-specific surface; signup sends verification email within 60s
    - _Requirements: 3.1, 3.9_

  - [x] 8.7 Implement session refresh near expiry and logout
    - Refresh the session when the access token is within 60s of expiry without interrupting the action; on logout terminate session and redirect to the public landing route within 2s; valid login redirects to the role home within 2s
    - _Requirements: 3.2, 3.4, 3.10_

  - [x] 8.8 Wire protected-route redirect and return-to-original-route via `safeRedirectPath`
    - Redirect unauthenticated users to login and return them to the originally requested route after authentication, using the existing open-redirect guard
    - _Requirements: 3.11_
    - _Design: per-page requireUser/requireRole + safeRedirectPath_

  - [x] 8.9 Write property test for safe post-login redirect
    - **Property 8: Post-login redirect target is always a safe internal path**
    - fast-check, `numRuns: 100`; assert the resolved redirect is always a same-origin internal path and never an external open redirect
    - **Validates: Requirements 3.11**

  - [x] 8.10 Write unit tests for auth schemas and lockout logic
    - Cover credential validation schemas and the 5-attempt/15-minute lockout state
    - _Requirements: 3.1, 3.3_

  - [x] 8.11 Write integration tests for auth workflows (success + failure)
    - Success and failure paths for signup, login, and password reset
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 9. Complete landlord flows end-to-end (Phase 4)
  - [x] 9.1 Complete listing CRUD and publish/unpublish
    - Create/edit/delete owned listings with confirmation within 3s; reject invalid forms with field indication and retained values; toggle publish visibility
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_
    - _Design: Landlord_Workspace (R4)_

  - [x] 9.2 Enforce listing image-upload bounds
    - Accept 1–20 images, ≤10 MB each, JPEG/PNG/WebP, and store/associate them; reject violations indicating the violated bound
    - _Requirements: 4.5, 4.6_

  - [x] 9.3 Display applicants per listing
    - Show applicants associated with each of the landlord's listings
    - _Requirements: 4.8_

  - [x] 9.4 Wire approve/reject transitions to the notification outbox
    - Use `update_application_status_checked` RPC + `isPermittedTransition` guard to transition to approved/rejected and notify the renter via Notification_Service
    - _Requirements: 4.9, 4.10_

  - [x] 9.5 Implement viewing-slot proposal with notification
    - Record the proposed slot and notify the renter via Notification_Service
    - _Requirements: 4.11_

  - [x] 9.6 Connect landlord to the scheduled video viewing
    - Join the conversation's Jitsi video session
    - _Requirements: 4.12_

  - [x] 9.7 Deliver landlord messages within 2s
    - Send messages over Supabase Realtime to the renter
    - _Requirements: 4.13_

  - [x] 9.8 Implement dashboard analytics
    - Display listing views and applicant counts on the landlord dashboard
    - _Requirements: 4.14_

  - [x] 9.9 Implement landlord profile update and ownership-denied authz
    - Persist profile changes with confirmation within 3s; deny actions on listings/applicants the landlord does not own with no resource change and an authorization-denied indication
    - _Requirements: 4.15, 4.16_

  - [x] 9.10 Confirm new-listing creation within 3s end-to-end
    - Wire the full create flow (form → action → RPC → confirmation) so creation confirms within 3s
    - _Requirements: 4.1_

  - [x] 9.11 Write property test for application state machine
    - **Property 7: Application state-machine transitions are valid and terminal-safe**
    - fast-check, `numRuns: 100`; assert `isPermittedTransition` permits only defined-workflow transitions and never transitions out of `approved`/`rejected`/`withdrawn`
    - **Validates: Requirements 4.9, 4.10, 5.10**

  - [x] 9.12 Write property test for Jitsi room round-trip
    - **Property 9: Jitsi room minting round-trip is consistent**
    - fast-check, `numRuns: 100`; assert parse → build → parse for room ids/URLs is consistent so both parties resolve to the same room
    - **Validates: Requirements 4.12, 5.13**

  - [x] 9.13 Write property test for file-upload bounds
    - **Property 15: File-upload bound enforcement**
    - fast-check, `numRuns: 100`; assert files >10 MB, >20 count, or disallowed type are rejected with the violated bound, and only conforming files stored
    - **Validates: Requirements 4.6, 5.9, 8.9**

  - [x] 9.14 Write integration tests for landlord workflows (success + failure)
    - Listing, application-decision, and viewing-proposal success and failure paths
    - _Requirements: 4.1, 4.2, 4.9, 4.10, 4.11_

- [x] 10. Complete renter flows end-to-end (Phase 5)
  - [x] 10.1 Implement marker clustering above 200 in-viewport markers
    - Display price-pin markers within the viewport and cluster when >200 markers fall within it
    - _Requirements: 5.1_
    - _Design: Renter_Workspace (R5)_

  - [x] 10.2 Implement viewport query within 2s
    - Query and display listings within the updated viewport within 2s over the `listings_in_viewport` RPC + GIST index on pan/zoom
    - _Requirements: 5.2_

  - [x] 10.3 Apply search filters
    - Display only listings satisfying the active filters
    - _Requirements: 5.3_

  - [x] 10.4 Display listing detail within 2s
    - Render the listing detail surface within 2s on selection
    - _Requirements: 5.4_

  - [x] 10.5 Implement save/unsave with reflected state within 2s
    - Persist favourite state and reflect it in the saved-listings surface within 2s
    - _Requirements: 5.5_

  - [x] 10.6 Implement application submit via `submit_application_atomic`
    - Create the application in `submitted`, notify the landlord, confirm within 5s; reject invalid applications retaining entered data and indicating invalid fields
    - _Requirements: 5.6, 5.7_

  - [x] 10.7 Enforce application document-upload bounds
    - Accept documents ≤10 MB each and ≤20 per application and store/associate them; reject failures/oversize indicating the failure
    - _Requirements: 5.8, 5.9_

  - [x] 10.8 Implement application withdraw and status display
    - Transition to withdrawn; display the status of each of the renter's applications
    - _Requirements: 5.10, 5.11_

  - [x] 10.9 Implement viewing-slot acceptance with notification
    - Confirm the viewing and notify the landlord via Notification_Service
    - _Requirements: 5.12_

  - [x] 10.10 Connect renter to video viewing within 10s with retry
    - Join the conversation's video session within 10s; on connection failure indicate the failure and offer a retry
    - _Requirements: 5.13, 5.14_

  - [x] 10.11 Implement message delivery with failure indicator
    - Deliver messages to the landlord within 2s and show a delivery-failure indicator when delivery does not succeed
    - _Requirements: 5.15_

  - [x] 10.12 Implement renter profile update within 2s
    - Persist profile changes with confirmation within 2s
    - _Requirements: 5.16_

  - [x] 10.13 Write property test for marker capping
    - **Property 10: Marker capping preserves a bounded in-order prefix**
    - fast-check, `numRuns: 100`; assert capping returns the first `min(length, MAX_MARKERS)` elements in input order and clustering applies above the configured count
    - **Validates: Requirements 5.1**

  - [x] 10.14 Write property test for "closest" ordering
    - **Property 11: "Closest" ordering is correct, stable, and null-last**
    - fast-check, `numRuns: 100`; assert ascending-distance order, stability for equal distances, and null distances placed last
    - **Validates: Requirements 5.2, 5.4**

  - [x] 10.15 Write property test for input validation
    - **Property 13: Input validation rejects invalid input while preserving submitted data**
    - fast-check, `numRuns: 100`; assert schema-invalid input is rejected with invalid fields indicated and submitted data preserved, and only valid input proceeds
    - **Validates: Requirements 5.7, 8.2, 8.3**

  - [x] 10.16 Write integration tests for renter workflows (success + failure)
    - Application, chat, viewing-acceptance, and notification success and failure paths
    - _Requirements: 5.6, 5.7, 5.12, 5.15_

- [x] 11. Checkpoint - Phases 3–5 flows complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. UX polish without redesign (Phase 6)
  - [x] 12.1 Implement reusable `LoadingSkeleton`, `EmptyState`, and `ErrorState` primitives
    - In `src/components/ui/`, reusing existing OKLCH tokens: skeleton dimensions match eventual content within ±10%; empty state has a message + ≥1 action; error state shows an error + retry and retains prior data until retry succeeds
    - _Requirements: 6.2, 6.3, 6.4_
    - _Design: UI_System / UX polish_

  - [x] 12.2 Add `loading.tsx`, `error.tsx`, and `not-found.tsx` boundaries per route segment
    - Add segment loading/error boundaries (Suspense fallbacks) and a root `not-found.tsx`
    - _Requirements: 6.2, 6.4, 7.9, 11.7_

  - [x] 12.3 Wire the retry control behaviour
    - On retry activation re-initiate the load and clear the error indication on success
    - _Requirements: 6.5_

  - [x] 12.4 Verify and fix responsive layout at 360/768/1280 px
    - No horizontal scrollbar, content overflow, or overlap at each width, preserving bento grids and the bottom-sheet shell; apply token-based spacing/typography across reachable routes
    - _Requirements: 6.6, 6.7_

  - [x] 12.5 Implement logical keyboard focus order and visible focus indicators
    - Focus order matches reading order; visible indicator with ≥3:1 contrast (reuse `focus-visible:ring-forest`) on every interactive element
    - _Requirements: 6.8_

  - [x] 12.6 Verify dark-mode contrast and theme toggle within 300ms
    - WCAG 2.1 AA contrast in light and dark mode; theme switch applied across reachable routes within 300ms
    - _Requirements: 6.9, 6.10_

  - [x] 12.7 Implement non-blocking micro-interactions ≤300ms
    - State-change transitions last ≤300ms without blocking further input
    - _Requirements: 6.11_

  - [x] 12.8 Wire bottom-sheet drag-to-expand/dismiss past the 25% threshold
    - Reuse existing `clampSheetHeight`/`snapSheetHeight` math in `map-discovery/lib/sheet.ts`
    - _Requirements: 6.12_

  - [x] 12.9 Ensure 44×44 px touch targets at mobile widths
    - Verify/adjust interactive control sizing at mobile viewport widths
    - _Requirements: 6.13_

  - [x] 12.10 Write property test for bottom-sheet height bounds
    - **Property 12: Bottom-sheet height always stays within bounds and snaps to a valid bound**
    - fast-check, `numRuns: 100`; assert the clamped height lies within `[0.25·vh, 0.90·vh]` and snaps to exactly one bound past the 25% threshold
    - **Validates: Requirements 6.12**

  - [x] 12.11 Write component tests for the loading/empty/error primitives
    - Cover skeleton sizing, empty-state action presence, and error-state retry + prior-data retention
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 13. Performance (Phase 7)
  - [x] 13.1 Apply RSC + Suspense streaming
    - Keep server-renderable routes on the server; stream so primary content is interactive before secondary content, using the new `loading.tsx` boundaries as fallbacks
    - _Requirements: 7.1, 7.5_
    - _Design: Performance_Layer_

  - [x] 13.2 Apply dynamic imports for heavy client modules
    - Load Google Maps, Jitsi embed, and dashboard charts via `next/dynamic` only when required
    - _Requirements: 7.3_

  - [x] 13.3 Implement Cloudflare-compatible image optimisation
    - Serve listing images in an optimised format at viewport-matched dimensions (Cloudflare Images / OpenNext image loader)
    - _Requirements: 7.2_

  - [x] 13.4 Ensure spatial-index usage with a missing-index fallback
    - Viewport queries use the GIST index `listings_location_gix`; if unavailable, still return correct results and record the missing-index condition
    - _Requirements: 7.4, 7.10_

  - [x] 13.5 Implement caching and route prefetch
    - Prefetch likely-next routes; cache repeatable read queries within the configured window
    - _Requirements: 7.6, 7.7_

  - [x] 13.6 Enforce the first-load JS budget and SSR fallback
    - Configure and enforce a per-route first-load client JS budget at build; on server-render failure serve the segment `error.tsx` fallback and record the failure
    - _Requirements: 7.8, 7.9_

  - [x] 13.7 Write unit test for the missing-index fallback path
    - Assert correct results and a recorded missing-index condition when the spatial index is absent
    - _Requirements: 7.10_

- [ ] 14. Security (Phase 8)
  - [x] 14.1 Make rate limiting fail closed in production
    - Absent Upstash config must fail closed (or block deploy) in production; apply 10 req/60s on auth routes and 60 req/60s on mutation routes; reject over-limit requests with a rate-limit indication
    - _Requirements: 8.5, 8.6_
    - _Design: Security_Layer_

  - [x] 14.2 Make Turnstile verification fail closed in production
    - Remove the non-production bypass in `verifyTurnstileToken`
    - _Requirements: 8.5_

  - [x] 14.3 Enforce Zod validation at every API route and Server Action boundary
    - Validate input against a Zod schema before processing; on failure reject, preserve submitted data, and indicate invalid input via `fieldErrorFailure`
    - _Requirements: 8.2, 8.3_

  - [x] 14.4 Enforce authorization checks on resource access
    - Deny unauthorised resource access returning no data and a not-authorised indication
    - _Requirements: 8.4_

  - [x] 14.5 Sanitise user-supplied content before render
    - Ensure no user-supplied script executes in rendered output
    - _Requirements: 8.7_

  - [x] 14.6 Enforce CSP and HSTS headers on every route
    - Single-source headers in `next.config.ts` `headers()`
    - _Requirements: 8.8_

  - [x] 14.7 Remove plaintext secrets from `wrangler.jsonc`
    - Move Supabase anon key + Google Maps API key out of committed `vars` to build-time/secret injection; load all secrets from validated env (`lib/env.ts`) and exclude them from client bundles and logs
    - _Requirements: 8.10_

  - [x] 14.8 Verify file-upload storage permissions
    - Validate file type and ≤10 MB; store accepted files under storage RLS restricting access to authorised users (`application-documents`/`listing-images` buckets)
    - _Requirements: 8.9_

  - [x] 14.9 Implement audit logging and verify RLS zero-rows
    - Emit structured audit entries (actor, action type, timestamp) for login, role change, application decision, and listing deletion; verify every table with user/listing data returns zero rows for an unauthenticated query
    - _Requirements: 8.1, 8.11_

  - [x] 14.10 Write property test for RLS denial
    - **Property 14: RLS denies access without an authenticated context**
    - fast-check, `numRuns: 100`; assert a query without an authenticated context returns zero rows and an unauthorised role is denied select/insert/update/delete with state preserved
    - **Validates: Requirements 8.1, 9.7**

  - [x] 14.11 Write unit tests for fail-closed rate limit and sanitisation
    - Assert production fail-closed behaviour for rate limit/Turnstile and that sanitisation strips executable script
    - _Requirements: 8.5, 8.7_

- [ ] 15. Database integrity (Phase 9)
  - [x] 15.1 Add missing foreign keys across the 27 migrations
    - Define an FK for every inter-table relationship; record any that lacked one as a Gap_Report entry
    - _Requirements: 9.1, 9.2_
    - _Design: Database_Layer_

  - [x] 15.2 Add missing indexes including PostGIS spatial indexes
    - Index columns in WHERE/JOIN/ORDER BY clauses and spatial indexes on PostGIS geometry/geography columns used by spatial queries
    - _Requirements: 9.3_

  - [x] 15.3 Add constraints enforcing documented invariants
    - Not-null/unique/check constraints; writes violating them are rejected preserving state and indicating the violation
    - _Requirements: 9.4, 9.5_

  - [x] 15.4 Complete RLS policies per role per operation
    - Grant access only to authorised roles for select/insert/update/delete on each table; deny unauthorised roles preserving state
    - _Requirements: 9.6, 9.7_

  - [x] 15.5 Conform schema objects to the documented naming convention
    - `snake_case` tables/columns, `*_idx`/`*_gix` indexes, `verb_noun` functions, descriptive policy names
    - _Requirements: 9.8_

  - [x] 15.6 Declare explicit security context on functions and triggers
    - Add explicit `security invoker|definer` to every function/trigger defined in migrations
    - _Requirements: 9.9_

  - [x] 15.7 Extend RLS test plans and verify fresh-DB apply
    - Extend `supabase/tests/rls-test-plan.sql` + `infra-hardening-test-plan.sql`; verify all migrations apply to a fresh DB without error and pass 100% of the RLS test plan
    - _Requirements: 9.10_

  - [x] 15.8 Write database tests per table for authorised/unauthorised access
    - For each table, verify RLS grants access to authorised roles and denies unauthorised roles
    - _Requirements: 9.6, 9.7_

- [x] 16. Checkpoint - Phases 6–9 hardening complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Testing coverage (Phase 10)
  - [x] 17.1 Complete unit-test coverage of schemas, state transitions, and pure functions
    - At least one unit test for every validation schema, state transition, and pure domain function (100% of these items): `applications/schema.ts`, `listings/schema.ts`, `applications/transitions.ts`, `viewings/slot-validation.ts`, `map-discovery/lib/*`, `lib/redirects.ts`, `chat/room.ts`, and the new audit/gate pure functions
    - _Requirements: 10.1_
    - _Design: Testing Strategy_

  - [x] 17.2 Add round-trip property tests for every parser and serializer
    - fast-check, `numRuns: 100`; for each parser/serializer pair (incl. `chat/room.ts`) assert parse → print → parse yields an equivalent value
    - _Requirements: 10.5_

  - [x] 17.3 Complete integration tests with success and failure paths per workflow
    - At least one success and one failure test for each of: application, listing, chat, viewing, notification
    - _Requirements: 10.2_

  - [x] 17.4 Implement Playwright E2E tests for the four Critical User Journeys
    - One test each for CUJ-1 (renter end-to-end), CUJ-2 (landlord end-to-end), CUJ-3 (auth resilience), CUJ-4 (mobile discovery), run against the production build
    - _Requirements: 10.3_

  - [x] 17.5 Complete database/RLS tests per table
    - Verify authorised-grant/unauthorised-deny per table
    - _Requirements: 10.4_

  - [x] 17.6 Add regression tests for each resolved Blocking_Issue
    - At least one regression test per resolved blocking issue (e.g. fail-open rate-limit fix, each added route-state boundary, each closed placeholder)
    - _Requirements: 10.6_

  - [x] 17.7 Wire CI test gating with failing-count reporting and 120s timeout
    - Extend CI so the test stage reports the failing-test count before the gate, one or more failures blocks the release, and each test is terminated and recorded as a failure after 120s
    - _Requirements: 10.7, 10.8, 10.9_

- [ ] 18. Production Readiness Exit Gate (Phase Gate, R11)
  - [x] 18.1 Implement the `ReleaseReport` schema and fail-safe verdict aggregation (`scripts/gate/run-gate.ts`)
    - Define the `CheckResult`/`ReleaseReport` Zod schemas; aggregate checks so any errored/failed check is a blocking issue, retaining findings unmodified; verdict is `passed` iff the blocking-issue list is empty, otherwise `failed` with every issue enumerated against its originating criterion
    - _Requirements: 11.9, 11.10_
    - _Design: Release_Gate design_

  - [x] 18.2 Implement the typescript, eslint, and tests checks
    - `tsc --noEmit` (R11.1), `eslint` (R11.2), and Vitest + Playwright result parse reporting failing-test count and forcing failure on ≥1 failure (R11.3, R10.8)
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 18.3 Implement the console-hydration check
    - Playwright console listener over each CUJ asserting zero error-level messages and zero hydration warnings
    - _Requirements: 11.4_

  - [x] 18.4 Implement the placeholders and todos checks
    - Reuse the audit `placeholders`/`route-states` collectors to confirm no placeholder/mock/fake responses on reachable routes, and no unresolved TODO in shipping paths
    - _Requirements: 11.5, 11.6_

  - [ ] 18.5 Implement the links check
    - Crawl reachable routes confirming each is accessible and no navigation link resolves to a missing route
    - _Requirements: 11.7_

  - [ ] 18.6 Implement the duplicate-requests, race-conditions, and memory-leaks checks
    - Over 10 consecutive CUJ iterations, assert no duplicated network requests, no state-update races, and listener/subscription counts return to pre-journey baseline
    - _Requirements: 11.8_

  - [ ] 18.7 Implement the secret-leaks check
    - Scan the client bundle and logs for secret leakage
    - _Requirements: 11.5, 8.10_

  - [ ] 18.8 Write property test for the gate verdict
    - **Property 5: Release_Gate verdict equals absence of blocking issues**
    - fast-check, `numRuns: 100`; assert `passed` iff the blocking-issue list is empty and, when `failed`, every issue is enumerated with its criterion and findings retained unmodified
    - **Validates: Requirements 11.9, 11.10**

  - [ ] 18.9 Write property test for failing-tests gating
    - **Property 6: Failing tests force a failed gate**
    - fast-check, `numRuns: 100`; assert that any failing-test count ≥1 yields a `failed` verdict with the test stage indicated as failed
    - **Validates: Requirements 10.8, 11.3**

  - [ ] 18.10 Wire the Release Gate as the final CI stage and produce the verdict
    - Add the gate as the last CI stage after e2e (with no in-progress-spec exemption) and run it to emit `release-report.json` with the launch verdict
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 12.5_

- [ ] 19. Final checkpoint - Release Gate passes
  - Ensure all tests pass and the Release Gate emits a passed verdict, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional/discretionary (property, unit, integration, component, and DB test sub-tasks) and can be deferred for a faster path; core implementation, config, and the dedicated Phase 10 coverage/CI tasks are required.
- Each task references the specific requirement clauses it satisfies and the design component it implements.
- Property-based test tasks reference their Correctness Property number and use fast-check with `numRuns: 100` minimum.
- Phase 1 audit tooling is built first because its Gap_Report scopes Phases 2–9; the Release Gate runs last and re-derives the verdict from the current codebase rather than trusting earlier phases.
- Checkpoints provide incremental validation between phase groups.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "2.2", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9"] },
    { "id": 2, "tasks": ["3.10", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 5, "tasks": ["6.6", "6.7"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8"] },
    { "id": 7, "tasks": ["8.9", "8.10", "8.11"] },
    { "id": 8, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9", "9.10"] },
    { "id": 9, "tasks": ["9.11", "9.12", "9.13", "9.14"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12"] },
    { "id": 11, "tasks": ["10.13", "10.14", "10.15", "10.16"] },
    { "id": 12, "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5", "12.6", "12.7", "12.8", "12.9"] },
    { "id": 13, "tasks": ["12.10", "12.11"] },
    { "id": 14, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6"] },
    { "id": 15, "tasks": ["13.7"] },
    { "id": 16, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "14.8", "14.9"] },
    { "id": 17, "tasks": ["14.10", "14.11"] },
    { "id": 18, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7"] },
    { "id": 19, "tasks": ["15.8"] },
    { "id": 20, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "17.6", "17.7"] },
    { "id": 21, "tasks": ["18.1", "18.2", "18.3", "18.4", "18.5", "18.6", "18.7"] },
    { "id": 22, "tasks": ["18.8", "18.9", "18.10"] }
  ]
}
```
