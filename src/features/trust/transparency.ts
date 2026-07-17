import type { TransparencyMetric } from "./types";

export const TRANSPARENCY_MINIMUM_GROUP_SIZE = 10;

export function suppressSmallTransparencyMetrics(
  metrics: Omit<TransparencyMetric, "suppressed">[],
  minimumGroupSize = TRANSPARENCY_MINIMUM_GROUP_SIZE,
): TransparencyMetric[] {
  return metrics.map((metric) => {
    const suppressed = metric.sampleSize < minimumGroupSize;
    return { ...metric, value: suppressed ? null : metric.value, suppressed };
  });
}
