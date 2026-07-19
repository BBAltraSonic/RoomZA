import { describe, expect, it } from "vitest";

import { isBuyerInterestStatus } from "./pipeline";

describe("buyer interest pipeline", () => {
  it("accepts only MVP pipeline statuses", () => {
    expect(isBuyerInterestStatus("negotiating")).toBe(true);
    expect(isBuyerInterestStatus("submitted")).toBe(false);
  });
});
