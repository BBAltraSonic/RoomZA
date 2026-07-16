import { describe, expect, it } from "vitest";

import { isNewListing } from "./listing-freshness";

const NOW = Date.parse("2026-07-13T12:00:00.000Z");

describe("isNewListing", () => {
  it("keeps the New badge for listings younger than seven days", () => {
    expect(isNewListing("2026-07-06T12:00:00.001Z", NOW)).toBe(true);
  });

  it("removes the New badge at the seven-day boundary", () => {
    expect(isNewListing("2026-07-06T12:00:00.000Z", NOW)).toBe(false);
  });

  it("rejects future and malformed listing dates", () => {
    expect(isNewListing("2026-07-14T12:00:00.000Z", NOW)).toBe(false);
    expect(isNewListing("not-a-date", NOW)).toBe(false);
  });
});
