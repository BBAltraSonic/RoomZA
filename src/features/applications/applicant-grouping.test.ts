import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { amenitiesSchema, emptyAmenities } from "@/features/listings/schema";
import { applicationStatuses } from "@/features/listings/insights";
import { bucketApplicantsForReview, groupApplicantsByStatus } from "./applicant-grouping";

describe("applicant grouping", () => {
  it("P10 groups by status and orders by recency", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.constantFrom(...applicationStatuses),
            created_at: fc.date({ noInvalidDate: true }).map((date) => date.toISOString()),
          }),
          { maxLength: 40 },
        ),
        (applications) => {
          const grouped = groupApplicantsByStatus(applications);
          for (const status of applicationStatuses) {
            const items = grouped[status];
            expect(items.every((application) => application.status === status)).toBe(true);
            for (let index = 1; index < items.length; index += 1) {
              const prev = items[index - 1];
              const curr = items[index];
              if (!prev || !curr) continue;
              expect(new Date(prev.created_at).getTime()).toBeGreaterThanOrEqual(new Date(curr.created_at).getTime());
            }
          }
        },
      ),
    );
  });

  it("P11 amenities schema round-trips valid category arrays", () => {
    fc.assert(
      fc.property(
        fc.record({
          essentials: fc.constantFrom(emptyAmenities.essentials),
          security: fc.constantFrom(emptyAmenities.security),
          lifestyle: fc.constantFrom(emptyAmenities.lifestyle),
          appliances: fc.constantFrom(emptyAmenities.appliances),
        }),
        (amenities) => {
          const parsed = amenitiesSchema.parse(amenities);
          expect(parsed).toEqual(amenities);
        },
      ),
    );
  });

  it("builds per-listing review buckets for active, approved, and closed applicants", () => {
    const applicants = [
      { status: "submitted" as const, created_at: "2026-07-01T08:00:00.000Z" },
      { status: "under_review" as const, created_at: "2026-07-01T09:00:00.000Z" },
      { status: "shortlisted" as const, created_at: "2026-07-01T10:00:00.000Z" },
      { status: "approved" as const, created_at: "2026-07-01T11:00:00.000Z" },
      { status: "rejected" as const, created_at: "2026-07-01T12:00:00.000Z" },
      { status: "withdrawn" as const, created_at: "2026-07-01T13:00:00.000Z" },
    ];

    const buckets = bucketApplicantsForReview(applicants);

    expect(buckets.activeApplicants.map((applicant) => applicant.status)).toEqual(["shortlisted", "submitted", "under_review"]);
    expect(buckets.approvedApplicants.map((applicant) => applicant.status)).toEqual(["approved"]);
    expect(buckets.inactiveApplicants.map((applicant) => applicant.status)).toEqual(["rejected", "withdrawn"]);
  });
});
