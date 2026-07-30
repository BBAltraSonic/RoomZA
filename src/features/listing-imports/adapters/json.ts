import { IMPORT_LIMITS } from "../limits";
import { assertSafeRecord } from "../normalization";
import type { AdapterParseOptions, SourceRecord } from "../types";
import { ADAPTER_VERSION, headersFromRecords, normalizeAdapterRecord, sliceRecords, type TextAdapter } from "./shared";

const normalizePath = (path: string) => path.replace(/^\$\.?/, "").split(".").filter(Boolean);

function collectArrayPaths(value: unknown, path = "$", output = new Set<string>()) {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === "object" && !Array.isArray(item))) output.add(path);
    value.slice(0, 3).forEach((item) => collectArrayPaths(item, `${path}[*]`, output));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => collectArrayPaths(child, `${path}.${key}`, output));
  }
  return output;
}

function recordsAtPath(value: unknown, recordPath?: string): SourceRecord[] {
  let current: unknown[] = [value];
  for (const segment of normalizePath(recordPath ?? "$")) {
    const wildcard = segment.endsWith("[*]");
    const key = wildcard ? segment.slice(0, -3) : segment;
    const next: unknown[] = [];
    for (const candidate of current) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) || !(key in candidate)) continue;
      const child = (candidate as Record<string, unknown>)[key];
      if (wildcard) {
        if (Array.isArray(child)) next.push(...child);
      } else if (Array.isArray(child) && current.length > 1) {
        next.push(...child);
      } else {
        next.push(child);
      }
    }
    current = next;
  }
  const records = current.length === 1 && Array.isArray(current[0]) ? current[0] : current;
  if (!Array.isArray(records)) throw new Error("The selected JSON record path is not an array.");
  if (!records.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    throw new Error("Every JSON record must be an object.");
  }
  if (records.length > IMPORT_LIMITS.maxRows) throw new Error(`Imports are limited to ${IMPORT_LIMITS.maxRows} rows.`);
  return records as SourceRecord[];
}

function parseJson(source: string) {
  const value: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  assertSafeRecord(value);
  return value;
}

export const jsonAdapter: TextAdapter = {
  kind: "json",
  version: ADAPTER_VERSION,
  inspect(source) {
    const parsed = parseJson(source);
    const recordPaths = [...collectArrayPaths(parsed)];
    const records = recordPaths.length === 1 ? recordsAtPath(parsed, recordPaths[0]) : [];
    return {
      sourceKind: "json",
      adapterVersion: ADAPTER_VERSION,
      headers: headersFromRecords(records.slice(0, 50)),
      recordPaths,
      estimatedRows: records.length || undefined,
      warnings: recordPaths.length > 1 ? ["Select the array that contains one object per listing."] : [],
    };
  },
  discoverHeaders(source, options) {
    return headersFromRecords(recordsAtPath(parseJson(source), options?.recordPath).slice(0, 50));
  },
  discoverRecordPaths(source) {
    return [...collectArrayPaths(parseJson(source))];
  },
  parseChunk(source, options: AdapterParseOptions) {
    return sliceRecords(recordsAtPath(parseJson(source), options.recordPath), options.cursor, options.limit);
  },
  normalize: normalizeAdapterRecord,
};
