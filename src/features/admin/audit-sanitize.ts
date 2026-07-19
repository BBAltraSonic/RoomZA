const forbiddenMetadataKey = /(content|body|document|file|url|email|phone|token|secret|password|cookie|session)/i;

export function sanitizeAuditMetadata(metadata: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !forbiddenMetadataKey.test(key))
      .map(([key, value]) => [key, typeof value === "string" && value.length > 500 ? value.slice(0, 500) : value]),
  );
}
