/**
 * Unit tests for the deterministic severity & owning-phase assignment rules
 * (`assignSeverityAndPhase`, R1.8).
 *
 * Covers one representative example per `GapCategory`, asserting:
 *   - the returned severity is exactly one of {blocker, major, minor};
 *   - the returned owning phase is a single valid phase in 2–9, OR null only
 *     for `audit-incomplete`;
 *   - the specific severity/phase mapping the design pins for that example.
 *
 * _Requirements: 1.8_
 */

import { describe, it, expect } from "vitest";
import {
  assignSeverityAndPhase,
  type GapCategory,
  type Severity,
  type SeverityAssignmentInput,
} from "./severity";

const SEVERITIES: readonly Severity[] = ["blocker", "major", "minor"];
const VALID_PHASES: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * One representative input per category, paired with the design-specified
 * severity and owning phase the rules must produce for that example.
 */
const CASES: ReadonlyArray<{
  readonly name: string;
  readonly input: SeverityAssignmentInput;
  readonly expectedSeverity: Severity;
  readonly expectedPhase: number | null;
}> = [
  {
    name: "missing-validation → blocker / phase 8",
    input: { category: "missing-validation", detail: "action accepts unvalidated body" },
    expectedSeverity: "blocker",
    expectedPhase: 8,
  },
  {
    name: "missing-route-state (error) → major / phase 6",
    input: { category: "missing-route-state", missingState: "error", detail: "no error boundary" },
    expectedSeverity: "major",
    expectedPhase: 6,
  },
  {
    name: "dead-code → minor / phase 2",
    input: { category: "dead-code", detail: "unreferenced module" },
    expectedSeverity: "minor",
    expectedPhase: 2,
  },
  {
    name: "db-integrity (FK) → blocker / phase 9",
    input: { category: "db-integrity", detail: "missing foreign key references on applications.listing_id" },
    expectedSeverity: "blocker",
    expectedPhase: 9,
  },
  {
    name: "architecture → major / phase 2",
    input: { category: "architecture", detail: "domain logic outside src/features" },
    expectedSeverity: "major",
    expectedPhase: 2,
  },
  {
    name: "placeholder → major / phase 6",
    input: { category: "placeholder", detail: "TODO: not implemented" },
    expectedSeverity: "major",
    expectedPhase: 6,
  },
  {
    name: "missing-observability (logging) → major / phase 8",
    input: { category: "missing-observability", missingObservability: "logging", detail: "no logger calls" },
    expectedSeverity: "major",
    expectedPhase: 8,
  },
  {
    name: "audit-incomplete → blocker / null phase",
    input: { category: "audit-incomplete", detail: "tasks.md unreadable" },
    expectedSeverity: "blocker",
    expectedPhase: null,
  },
  {
    name: "missing-feature (auth) → blocker / inferred phase 3",
    input: { category: "missing-feature", detail: "password reset login flow", feature: "auth" },
    expectedSeverity: "blocker",
    expectedPhase: 3,
  },
  {
    name: "missing-feature (landlord) → blocker / inferred phase 4",
    input: { category: "missing-feature", detail: "listing dashboard for landlord owner" },
    expectedSeverity: "blocker",
    expectedPhase: 4,
  },
  {
    name: "missing-feature (default) → blocker / inferred phase 5",
    input: { category: "missing-feature", detail: "something unclassifiable" },
    expectedSeverity: "blocker",
    expectedPhase: 5,
  },
  {
    name: "in-progress-spec (renter) → major / inferred phase 5",
    input: { category: "in-progress-spec", detail: "renter map discovery spec incomplete" },
    expectedSeverity: "major",
    expectedPhase: 5,
  },
];

describe("assignSeverityAndPhase", () => {
  for (const { name, input, expectedSeverity, expectedPhase } of CASES) {
    it(`assigns the design-specified severity and phase: ${name}`, () => {
      const result = assignSeverityAndPhase(input);
      expect(result.severity).toBe(expectedSeverity);
      expect(result.owningPhase).toBe(expectedPhase);
    });

    it(`returns a single valid severity and owning phase: ${name}`, () => {
      const { severity, owningPhase } = assignSeverityAndPhase(input);

      // Exactly one severity from the allowed set.
      expect(SEVERITIES).toContain(severity);

      if (input.category === "audit-incomplete") {
        // null owning phase is permitted only for audit-incomplete.
        expect(owningPhase).toBeNull();
      } else {
        expect(owningPhase).not.toBeNull();
        expect(VALID_PHASES).toContain(owningPhase as number);
      }
    });
  }

  it("covers one example for every GapCategory", () => {
    const allCategories: readonly GapCategory[] = [
      "missing-feature",
      "placeholder",
      "missing-route-state",
      "missing-validation",
      "missing-observability",
      "dead-code",
      "architecture",
      "db-integrity",
      "in-progress-spec",
      "audit-incomplete",
    ];
    const covered = new Set(CASES.map((c) => c.input.category));
    for (const category of allCategories) {
      expect(covered.has(category)).toBe(true);
    }
  });

  it("is deterministic: identical input yields identical output", () => {
    const input: SeverityAssignmentInput = {
      category: "db-integrity",
      detail: "missing foreign key references",
    };
    expect(assignSeverityAndPhase(input)).toEqual(assignSeverityAndPhase(input));
  });

  it("assigns minor to non-error route-state gaps (loading/empty)", () => {
    expect(assignSeverityAndPhase({ category: "missing-route-state", missingState: "loading" }).severity).toBe("minor");
    expect(assignSeverityAndPhase({ category: "missing-route-state", missingState: "empty" }).severity).toBe("minor");
  });
});
