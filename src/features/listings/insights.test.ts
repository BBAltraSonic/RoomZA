import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { applicationStatuses, computeInsights } from "./insights";

const statusArb = fc.constantFrom(...applicationStatuses);

describe("listing insights", () => {
  it("P7 aggregates applications and zero-fills every status", () => {
    fc.assert(
      fc.property(fc.array(statusArb, { maxLength: 60 }), (statuses) => {
        const insights = computeInsights(statuses.map((status) => ({ status })), [], new Date("2026-06-03T00:00:00.000Z"));
        expect(insights.totalApplications).toBe(statuses.length);
        for (const status of applicationStatuses) {
          expect(insights.applicationsByStatus[status]).toBe(statuses.filter((item) => item === status).length);
        }
      }),
    );
  });

  it("P8 counts future non-cancelled viewings", () => {
    const now = new Date("2026-06-03T10:00:00.000Z");
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            offsetMinutes: fc.integer({ min: -120, max: 120 }),
            status: fc.constantFrom("booked", "cancelled", "completed" as const),
          }),
          { maxLength: 40 },
        ),
        (rows) => {
          const viewings = rows.map((row) => ({
            status: row.status,
            slot: { start_time: new Date(now.getTime() + row.offsetMinutes * 60_000).toISOString() },
          }));
          const expected = rows.filter((row) => row.status !== "cancelled" && row.offsetMinutes > 0).length;
          expect(computeInsights([], viewings, now).upcomingViewings).toBe(expected);
        },
      ),
    );
  });

  it("keeps the supplied listing view total", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20_000 }), (totalViews) => {
        expect(computeInsights([], [], new Date("2026-06-03T00:00:00.000Z"), totalViews).totalViews).toBe(totalViews);
      }),
    );
  });
});
