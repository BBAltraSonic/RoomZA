import { describe, expect, it } from "vitest";

import { csvAdapter } from "./csv";
import { jsonAdapter } from "./json";
import { createPinpointV1Export, pinpointV1Adapter } from "./pinpoint-v1";
import { xmlAdapter } from "./xml";

describe("generic listing source adapters", () => {
  it("reads UTF-8 BOM CSV and detects an alternate delimiter", async () => {
    const source = "\uFEFFReference;Title;Price\nZA-1;Braamfontein loft;R 9,500";
    const inspection = await csvAdapter.inspect(source);
    const rows = await csvAdapter.parseChunk(source, { cursor: 0, limit: 10 });
    expect(inspection.headers).toEqual(["Reference", "Title", "Price"]);
    expect(rows[0]?.raw.Title).toBe("Braamfontein loft");
  });

  it("keeps formula-looking cells as inert values", async () => {
    const rows = await csvAdapter.parseChunk("Title,Description\nHome,=HYPERLINK(\"https://example.test\")", { cursor: 0, limit: 10 });
    expect(rows[0]?.raw.Description).toContain("=HYPERLINK");
  });

  it("discovers and parses an explicitly selected nested JSON record path", () => {
    const source = JSON.stringify({ export: { offices: [{ listings: [{ ref: "A" }, { ref: "B" }] }] } });
    const paths = jsonAdapter.discoverRecordPaths?.(source) ?? [];
    expect(paths).toContain("$.export.offices[*].listings");
    expect(jsonAdapter.parseChunk(source, { recordPath: "$.export.offices[*].listings", limit: 10 })).toHaveLength(2);
  });

  it("rejects prototype-polluting JSON keys", () => {
    const source = '{"listings":[{"constructor":{"prototype":{"polluted":true}}}]}';
    expect(() => jsonAdapter.inspect(source)).toThrow(/Unsafe JSON key/);
  });

  it("discovers repeating XML records and blocks entities", () => {
    const source = "<feed><listing><ref>A</ref><title>One</title></listing><listing><ref>B</ref><title>Two</title></listing></feed>";
    expect(xmlAdapter.discoverRecordPaths?.(source)).toContain("/feed/listing");
    expect(xmlAdapter.parseChunk(source, { recordPath: "/feed/listing", limit: 10 })).toHaveLength(2);
    expect(() => xmlAdapter.inspect('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><x>&a;</x>')).toThrow(/entities/i);
  });

  it("round-trips a Pinpoint schema version 1 export", async () => {
    const exportJson = createPinpointV1Export([{ sourceReference: "PIN-1", title: "Original copy" }]);
    const rows = await pinpointV1Adapter.parseChunk(exportJson, { cursor: 0, limit: 10 });
    expect(rows[0]?.raw).toMatchObject({ sourceReference: "PIN-1", title: "Original copy" });
  });
});
