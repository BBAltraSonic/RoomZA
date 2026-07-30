export const IMPORT_LIMITS = {
  maxRows: 25_000,
  structuredSourceBytes: 100 * 1024 * 1024,
  xlsxBytes: 25 * 1024 * 1024,
  zipBytes: 2 * 1024 * 1024 * 1024,
  imageBytes: 10 * 1024 * 1024,
  imagesPerListing: 20,
  chunkRows: 500,
  progressRows: 250,
  progressMilliseconds: 2_000,
  geocodeBatchSize: 50,
  imageConcurrencyPerOrganization: 4,
  sourceRetentionDays: 30,
  auditRetentionDays: 365,
  tusChunkBytes: 6 * 1024 * 1024,
} as const;

export function sourceLimitBytes(kind: "xlsx" | "zip" | "structured") {
  if (kind === "xlsx") return IMPORT_LIMITS.xlsxBytes;
  if (kind === "zip") return IMPORT_LIMITS.zipBytes;
  return IMPORT_LIMITS.structuredSourceBytes;
}
