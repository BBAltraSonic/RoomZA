import { SaxesParser } from "saxes";

import { IMPORT_LIMITS } from "../limits";
import type { AdapterParseOptions, SourceRecord } from "../types";
import { ADAPTER_VERSION, headersFromRecords, normalizeAdapterRecord, sliceRecords, type TextAdapter } from "./shared";

function rejectUnsafeXml(source: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("XML document types and entities are not allowed.");
}

function parseXml(source: string) {
  rejectUnsafeXml(source);
  const parser = new SaxesParser({ xmlns: false });
  const stack: Array<{ name: string; value: SourceRecord; text: string }> = [];
  const paths = new Map<string, SourceRecord[]>();

  parser.on("opentag", (tag) => {
    stack.push({ name: String(tag.name), value: {}, text: "" });
  });
  parser.on("text", (text) => {
    const current = stack.at(-1);
    if (current) current.text += text;
  });
  parser.on("closetag", () => {
    const node = stack.pop();
    if (!node) return;
    const content = node.text.trim();
    const value: unknown = Object.keys(node.value).length ? node.value : content;
    const path = `/${[...stack.map((item) => item.name), node.name].join("/")}`;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const records = paths.get(path) ?? [];
      records.push(value as SourceRecord);
      paths.set(path, records);
    }

    const parent = stack.at(-1);
    if (parent) {
      const existing = parent.value[node.name];
      if (existing === undefined) parent.value[node.name] = value as never;
      else if (Array.isArray(existing)) existing.push(value as never);
      else parent.value[node.name] = [existing, value] as never;
    }
  });
  parser.write(source).close();
  return paths;
}

function recordPaths(source: string) {
  return [...parseXml(source).entries()]
    .filter(([, records]) => records.length > 1)
    .map(([path]) => path);
}

function xmlRecords(source: string, path?: string) {
  if (!path) throw new Error("Select the repeating XML record path.");
  const records = parseXml(source).get(path) ?? [];
  if (records.length > IMPORT_LIMITS.maxRows) throw new Error(`Imports are limited to ${IMPORT_LIMITS.maxRows} rows.`);
  return records;
}

export const xmlAdapter: TextAdapter = {
  kind: "xml",
  version: ADAPTER_VERSION,
  inspect(source) {
    const paths = recordPaths(source);
    return {
      sourceKind: "xml",
      adapterVersion: ADAPTER_VERSION,
      headers: paths.length === 1 ? headersFromRecords(xmlRecords(source, paths[0]).slice(0, 50)) : [],
      recordPaths: paths,
      estimatedRows: paths.length === 1 ? xmlRecords(source, paths[0]).length : undefined,
      warnings: paths.length !== 1 ? ["Select the repeating element that represents one listing."] : [],
    };
  },
  discoverHeaders(source, options) {
    return headersFromRecords(xmlRecords(source, options?.recordPath).slice(0, 50));
  },
  discoverRecordPaths: recordPaths,
  parseChunk(source, options: AdapterParseOptions) {
    return sliceRecords(xmlRecords(source, options.recordPath), options.cursor, options.limit);
  },
  normalize: normalizeAdapterRecord,
};
