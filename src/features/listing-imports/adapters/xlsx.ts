import readXlsxFile, { type Row } from "read-excel-file/browser";

import { IMPORT_LIMITS } from "../limits";
import type { AdapterParseOptions, ListingSourceAdapter, SourceRecord } from "../types";
import { ADAPTER_VERSION, headersFromRecords, normalizeAdapterRecord, sliceRecords } from "./shared";

export type XlsxSource = Blob;

function rowsToRecords(rows: Row[]) {
  const [headerRow = [], ...body] = rows;
  const headers = headerRow.map((value, index) => String(value ?? `Column ${index + 1}`).trim());
  const records = body
    .filter((row) => row.some((value) => value !== null && value !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])) as SourceRecord);
  if (records.length > IMPORT_LIMITS.maxRows) throw new Error(`Imports are limited to ${IMPORT_LIMITS.maxRows} rows.`);
  return records;
}

async function workbook(source: XlsxSource) {
  if (source.size > IMPORT_LIMITS.xlsxBytes) throw new Error("XLSX files are limited to 25 MB.");
  return readXlsxFile(source);
}

async function records(source: XlsxSource, sheet?: string) {
  const sheets = await workbook(source);
  const selected = sheet ? sheets.find((candidate) => candidate.sheet === sheet) : sheets[0];
  if (!selected) throw new Error("The selected worksheet was not found.");
  return rowsToRecords(selected.data);
}

export const xlsxAdapter: ListingSourceAdapter<XlsxSource> = {
  kind: "xlsx",
  version: ADAPTER_VERSION,
  async inspect(source) {
    const book = await workbook(source);
    const sheets = book.map((sheet) => sheet.sheet);
    const firstRecords = sheets.length === 1 ? rowsToRecords(book[0]!.data) : [];
    return {
      sourceKind: "xlsx",
      adapterVersion: ADAPTER_VERSION,
      headers: headersFromRecords(firstRecords.slice(0, 50)),
      sheets,
      estimatedRows: firstRecords.length || undefined,
      warnings: sheets.length > 1 ? ["Select the worksheet that contains the listings."] : [],
    };
  },
  async discoverHeaders(source, options) {
    return headersFromRecords((await records(source, options?.sheet)).slice(0, 50));
  },
  async parseChunk(source, options: AdapterParseOptions) {
    return sliceRecords(await records(source, options.sheet), options.cursor, options.limit);
  },
  normalize: normalizeAdapterRecord,
};
