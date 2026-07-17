import { describe, expect, it } from "vitest";

import { suppressSmallTransparencyMetrics } from "./transparency";

describe("transparency metric suppression", () => {
  it("hides both counts and derived values below the publication threshold", () => {
    const [metric] = suppressSmallTransparencyMetrics([{ key: "fraud_removed", label: "Fraudulent listings removed", value: 4, sampleSize: 4 }]);
    expect(metric).toMatchObject({ value: null, sampleSize: 4, suppressed: true });
  });

  it("publishes a metric when the sample reaches the threshold", () => {
    const [metric] = suppressSmallTransparencyMetrics([{ key: "reports_received", label: "Reports received", value: 10, sampleSize: 10 }]);
    expect(metric).toMatchObject({ value: 10, sampleSize: 10, suppressed: false });
  });
});
