import { describe, expect, it } from "vitest";

import { mergeProgressStage, normalizeCompletedStages } from "./progress";

describe("purchase progress", () => {
  it("deduplicates and preserves known completed stages", () => {
    expect(normalizeCompletedStages(["property_saved", "property_saved", "negotiating"])).toEqual([
      "property_saved",
      "negotiating",
    ]);
  });

  it("advances current stage to the first incomplete milestone", () => {
    expect(mergeProgressStage(["property_saved"], "contacted_seller")).toEqual({
      completedStages: ["property_saved", "contacted_seller"],
      currentStage: "viewing_scheduled",
    });
  });
});
