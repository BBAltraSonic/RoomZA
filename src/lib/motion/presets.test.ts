import { describe, expect, it } from "vitest";

import { routeVariants } from "./presets";

describe("route motion presets", () => {
  it("releases the fixed-position containing block after route settlement", () => {
    expect(routeVariants.animate).toMatchObject({
      filter: "none",
      transitionEnd: { filter: "none" },
    });
  });
});
