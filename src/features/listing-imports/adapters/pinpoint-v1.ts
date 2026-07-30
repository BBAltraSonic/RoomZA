import type { AdapterParseOptions, SourceRecord } from "../types";
import { assertSafeRecord } from "../normalization";
import { ADAPTER_VERSION, headersFromRecords, normalizeAdapterRecord, sliceRecords, type TextAdapter } from "./shared";

type PinpointV1Export = {
  schemaVersion: 1;
  exportedAt?: string;
  listings: SourceRecord[];
};

function parse(source: string): PinpointV1Export {
  const value = JSON.parse(source.replace(/^\uFEFF/, "")) as Partial<PinpointV1Export>;
  assertSafeRecord(value);
  if (value.schemaVersion !== 1 || !Array.isArray(value.listings)) {
    throw new Error("This is not a Pinpoint schema version 1 export.");
  }
  return value as PinpointV1Export;
}

export const pinpointV1Adapter: TextAdapter = {
  kind: "pinpoint_v1",
  version: ADAPTER_VERSION,
  inspect(source) {
    const value = parse(source);
    return {
      sourceKind: "pinpoint_v1",
      adapterVersion: ADAPTER_VERSION,
      headers: headersFromRecords(value.listings.slice(0, 50)),
      estimatedRows: value.listings.length,
      warnings: [],
    };
  },
  discoverHeaders(source) {
    return headersFromRecords(parse(source).listings.slice(0, 50));
  },
  parseChunk(source, options: AdapterParseOptions) {
    return sliceRecords(parse(source).listings, options.cursor, options.limit);
  },
  normalize: normalizeAdapterRecord,
};

export function createPinpointV1Export(listings: SourceRecord[]) {
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), listings }, null, 2);
}
