import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { isPermittedTransition, permittedTransitions, type ApplicationStatus } from "./transitions";

const statuses: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "rejected", "approved", "withdrawn"];

describe("application transitions", () => {
  it("Property 7: Application state-machine transitions are valid and terminal-safe", () => {
    fc.assert(
      fc.property(fc.constantFrom(...statuses), fc.constantFrom(...statuses), (from, to) => {
        expect(isPermittedTransition(from, to)).toBe(permittedTransitions(from).includes(to));
        if (["rejected", "approved", "withdrawn"].includes(from)) {
          expect(isPermittedTransition(from, to)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
