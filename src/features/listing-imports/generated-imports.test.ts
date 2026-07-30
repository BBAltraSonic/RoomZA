import { describe, expect, it } from "vitest";

import { csvAdapter } from "./adapters";

function generatedCsv(rows: number) {
  return [
    "reference,title,address,price,latitude,longitude",
    ...Array.from({ length: rows }, (_, index) =>
      `REF-${index + 1},Listing ${index + 1},${index + 1} Main Road Johannesburg,${5_000 + index},-26.2041,28.0473`
    ),
  ].join("\n");
}

describe("generated import baselines", () => {
  it.each([1_000, 10_000])("keeps %i-row parsing cursor-stable and chunk-bounded", async (size) => {
    const source = generatedCsv(size);
    const first = await csvAdapter.parseChunk(source, { cursor: 0, limit: 500 });
    const middle = await csvAdapter.parseChunk(source, { cursor: 500, limit: 500 });
    const final = await csvAdapter.parseChunk(source, { cursor: size - 500, limit: 500 });
    expect(first).toHaveLength(500);
    expect(middle[0]?.rowNumber).toBe(501);
    expect(final.at(-1)?.rowNumber).toBe(size);
    expect(new Set([...first, ...middle, ...final].map((row) => row.rowNumber)).size).toBe(size === 1_000 ? 1_000 : 1_500);
  });
});
