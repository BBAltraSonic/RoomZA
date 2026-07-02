// Feature: production-readiness-hardening, Property 4
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SpecName, SpecResult } from "./schema";

/**
 * Property 4: A spec without a readable tasks list is never marked passed.
 *
 * The {@link SpecResult} schema enforces the R12.3 invariant via `.superRefine`:
 * whenever `tasksFileFound === false`, `passed` must be `false`. This test
 * generates arbitrary SpecResult-shaped objects and asserts the schema rejects
 * exactly the forbidden combination (`tasksFileFound === false && passed === true`)
 * and accepts every otherwise-valid object.
 *
 * Validates: Requirements 12.3
 */

/** Generates a structurally-valid SpecResult input with free `tasksFileFound`/`passed`. */
const specResultArb = fc.record({
  spec: fc.constantFrom(...SpecName.options),
  tasksFileFound: fc.boolean(),
  ownTasks: fc.record({
    total: fc.nat({ max: 500 }),
    incomplete: fc.nat({ max: 500 }),
  }),
  criteriaResults: fc.array(
    fc.record({
      requirement: fc.string(),
      result: fc.constantFrom("pass", "fail", "n/a"),
    }),
    { maxLength: 20 },
  ),
  referencedCriteria: fc.array(fc.string(), { maxLength: 20 }),
  passed: fc.boolean(),
});

describe("SpecResult — Property 4: unreadable-spec safety (R12.3)", () => {
  it("rejects any result with tasksFileFound === false && passed === true, accepts the rest", () => {
    fc.assert(
      fc.property(specResultArb, (candidate) => {
        const parsed = SpecResult.safeParse(candidate);
        const forbidden = candidate.tasksFileFound === false && candidate.passed === true;

        // The schema accepts iff the object is NOT the forbidden combination.
        expect(parsed.success).toBe(!forbidden);
      }),
      { numRuns: 100 },
    );
  });

  it("never accepts a passed result whose tasks list was not found", () => {
    fc.assert(
      fc.property(specResultArb, (candidate) => {
        const parsed = SpecResult.safeParse(candidate);
        // Contrapositive of R12.3: if it parsed, then tasksFileFound===false ⇒ passed===false.
        if (parsed.success && parsed.data.tasksFileFound === false) {
          expect(parsed.data.passed).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("rejects the explicit unreadable-but-passed case", () => {
    const result = SpecResult.safeParse({
      spec: "landlord-listing-management",
      tasksFileFound: false,
      ownTasks: { total: 0, incomplete: 0 },
      criteriaResults: [],
      referencedCriteria: [],
      passed: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts an unreadable spec that is not marked passed", () => {
    const result = SpecResult.safeParse({
      spec: "discovery-pop",
      tasksFileFound: false,
      ownTasks: { total: 0, incomplete: 0 },
      criteriaResults: [],
      referencedCriteria: [],
      passed: false,
    });
    expect(result.success).toBe(true);
  });
});
