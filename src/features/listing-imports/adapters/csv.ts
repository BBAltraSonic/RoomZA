import Papa from "papaparse";

import { IMPORT_LIMITS } from "../limits";
import { assertSafeRecord } from "../normalization";
import type { AdapterParseOptions, SourceRecord } from "../types";
import { ADAPTER_VERSION, headersFromRecords, normalizeAdapterRecord, sliceRecords, type TextAdapter } from "./shared";

function parseCsv(source: string, delimiter?: string) {
  const parsed = Papa.parse<SourceRecord>(source.replace(/^\uFEFF/, ""), {
    header: true,
    delimiter: delimiter || "",
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.some((error) => error.type === "Quotes" || error.type === "Delimiter")) {
    throw new Error(parsed.errors[0]?.message ?? "Malformed delimited source.");
  }
  if (parsed.data.length > IMPORT_LIMITS.maxRows) throw new Error(`Imports are limited to ${IMPORT_LIMITS.maxRows} rows.`);
  parsed.data.forEach((record) => assertSafeRecord(record));
  return parsed.data;
}

export const csvAdapter: TextAdapter = {
  kind: "csv",
  version: ADAPTER_VERSION,
  inspect(source) {
    const records = parseCsv(source);
    return {
      sourceKind: "csv",
      adapterVersion: ADAPTER_VERSION,
      headers: headersFromRecords(records.slice(0, 50)),
      estimatedRows: records.length,
      warnings: [],
    };
  },
  discoverHeaders(source, options) {
    return headersFromRecords(parseCsv(source, options?.delimiter).slice(0, 50));
  },
  parseChunk(source, options: AdapterParseOptions) {
    return sliceRecords(parseCsv(source, options.delimiter), options.cursor, options.limit);
  },
  normalize: normalizeAdapterRecord,
};

export const pastedTableAdapter: TextAdapter = {
  ...csvAdapter,
  kind: "pasted_table",
  inspect(source) {
    const inspection = csvAdapter.inspect(source);
    return { ...inspection, sourceKind: "pasted_table" };
  },
};
