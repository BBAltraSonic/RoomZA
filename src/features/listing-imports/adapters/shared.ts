import { mapRecord } from "../normalization";
import type {
  CanonicalImportListing,
  ImportMapping,
  ListingSourceAdapter,
  ParsedRecord,
  SourceRecord,
} from "../types";

export const ADAPTER_VERSION = "1.0.0";

export function headersFromRecords(records: SourceRecord[]) {
  return [...new Set(records.flatMap((record) => Object.keys(record)))];
}

export function sliceRecords(records: SourceRecord[], cursor = 0, limit = 500): ParsedRecord[] {
  return records.slice(cursor, cursor + limit).map((raw, index) => ({
    rowNumber: cursor + index + 1,
    raw,
  }));
}

export function normalizeAdapterRecord(
  record: ParsedRecord,
  mapping: ImportMapping,
  defaults?: Partial<CanonicalImportListing>,
) {
  return mapRecord(record, mapping, defaults);
}

export type TextAdapter = ListingSourceAdapter<string>;
