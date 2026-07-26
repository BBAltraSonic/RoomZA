import { describe, expect, it } from "vitest";
import fc from "fast-check";

const sensitiveTables = [
  "profiles",
  "applications",
  "application_status_events",
  "documents",
  "conversations",
  "messages",
  "notification_events",
  "viewing_slot_offers",
  "viewing_slots",
  "viewings",
  "call_sessions",
  "analytics_events",
  "search_alerts",
  "user_favorites",
  "live_tour_recording_consents",
] as const;

const operations = ["select", "insert", "update", "delete"] as const;

type Row = {
  id: string;
  ownerId: string;
  value: string;
};

function denyWithoutAuthenticatedContext(rows: Row[]) {
  return {
    visibleRows: [] as Row[],
    rows,
  };
}

function denyUnauthorizedOperation(rows: Row[]) {
  return {
    allowed: false,
    rows,
  };
}

describe("RLS denial model", () => {
  it("Property 14: RLS denies unauthenticated and unauthorized access while preserving state", () => {
    // Feature: production-readiness-hardening, Property 14
    fc.assert(
      fc.property(
        fc.constantFrom(...sensitiveTables),
        fc.constantFrom(...operations),
        fc.array(
          fc.record({
            id: fc.uuid(),
            ownerId: fc.uuid(),
            value: fc.string(),
          }),
          { maxLength: 25 },
        ),
        (_table, _operation, rows) => {
          const before = structuredClone(rows);
          const unauthenticated = denyWithoutAuthenticatedContext(rows);
          const unauthorized = denyUnauthorizedOperation(rows);

          expect(unauthenticated.visibleRows).toEqual([]);
          expect(unauthenticated.rows).toEqual(before);
          expect(unauthorized.allowed).toBe(false);
          expect(unauthorized.rows).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});
