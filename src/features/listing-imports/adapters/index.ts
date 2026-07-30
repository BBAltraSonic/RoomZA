import type { ImportSourceKind, ListingSourceAdapter } from "../types";
import { csvAdapter, pastedTableAdapter } from "./csv";
import { jsonAdapter } from "./json";
import { pinpointV1Adapter } from "./pinpoint-v1";
import { xlsxAdapter } from "./xlsx";
import { xmlAdapter } from "./xml";

const adapters: Partial<Record<ImportSourceKind, ListingSourceAdapter<never>>> = {
  csv: csvAdapter as ListingSourceAdapter<never>,
  pasted_table: pastedTableAdapter as ListingSourceAdapter<never>,
  json: jsonAdapter as ListingSourceAdapter<never>,
  xml: xmlAdapter as ListingSourceAdapter<never>,
  xlsx: xlsxAdapter as ListingSourceAdapter<never>,
  pinpoint_v1: pinpointV1Adapter as ListingSourceAdapter<never>,
};

export function getSourceAdapter(kind: ImportSourceKind) {
  const adapter = adapters[kind];
  if (!adapter) throw new Error(`Source kind ${kind} does not contain listing records.`);
  return adapter;
}

export { csvAdapter, jsonAdapter, pastedTableAdapter, pinpointV1Adapter, xlsxAdapter, xmlAdapter };
