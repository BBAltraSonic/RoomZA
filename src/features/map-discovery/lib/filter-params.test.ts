import { describe, expect, it } from "vitest";

import { filtersFromSearchParams } from "./filter-params";

describe("filtersFromSearchParams", () => {
  it("reads every filter the filter bar writes", () => {
    expect(filtersFromSearchParams(new URLSearchParams("minPrice=2000&maxPrice=4000&beds=2&baths=1&type=room,studio&availableNow=1&liveTours=1"))).toEqual({
      price: { min: 2000, max: 4000 },
      beds: 2,
      baths: 1,
      propertyTypes: ["room", "studio"],
      availableNow: true,
      liveTours: true,
    });
  });

  it("ignores values that are not positive numbers", () => {
    expect(filtersFromSearchParams(new URLSearchParams("maxPrice=abc&beds=-2&type="))).toEqual({
      price: { min: undefined, max: undefined },
      beds: undefined,
      baths: undefined,
      propertyTypes: undefined,
    });
  });
});
