import { IMPORT_LIMITS } from "../limits";

export type ArchiveEntryMetadata = {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  directory?: boolean;
};

const allowedImageExtension = /\.(?:jpe?g|png|webp)$/i;

export function validateArchiveEntries(entries: ArchiveEntryMetadata[]) {
  const issues: string[] = [];
  let totalUncompressed = 0;

  for (const entry of entries) {
    if (entry.directory) continue;
    const normalized = entry.filename.replaceAll("\\", "/");
    if (
      normalized.startsWith("/")
      || /^[a-z]:\//i.test(normalized)
      || normalized.split("/").includes("..")
    ) {
      issues.push(`Unsafe archive path: ${entry.filename}`);
      continue;
    }
    if (!allowedImageExtension.test(normalized)) issues.push(`Unsupported archive entry: ${entry.filename}`);
    if (entry.uncompressedSize > IMPORT_LIMITS.imageBytes) issues.push(`Image exceeds 10 MB: ${entry.filename}`);
    if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > 100) {
      issues.push(`Suspicious compression ratio: ${entry.filename}`);
    }
    totalUncompressed += entry.uncompressedSize;
  }

  if (totalUncompressed > IMPORT_LIMITS.zipBytes * 5) {
    issues.push("Archive expands beyond the safe uncompressed limit.");
  }
  return { safe: issues.length === 0, issues, totalUncompressed };
}
