import { describe, expect, it } from "vitest";

import { collectArchitecture } from "./architecture";

describe("architecture conformance", () => {
  it("returns zero architecture violations for the current source tree", () => {
    expect(collectArchitecture()).toEqual([]);
  });
});
