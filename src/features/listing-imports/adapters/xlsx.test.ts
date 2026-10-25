import { describe, expect, it } from "vitest";
import { xlsxAdapter } from "./xlsx";
import { importWorkbookBytes } from "./xlsx.fixtures";

const workbook = async () => new Blob([new Uint8Array(await importWorkbookBytes())]);

describe("real XLSX import inspection and selected worksheet", () => {
  it("inspects both worksheets without suggesting the instruction sheet's columns", async () => {
    expect(await xlsxAdapter.inspect(await workbook())).toMatchObject({
      sheets: ["Instructions", "Listings"], headers: [],
      warnings: ["Select the worksheet that contains the listings."],
    });
  });

  it("parses the explicitly selected worksheet with numeric cells and stable row numbers", async () => {
    const source = await workbook();
    expect(await xlsxAdapter.discoverHeaders(source, { sheet: "Listings" })).toEqual(["title", "listingType", "price", "address", "latitude", "longitude"]);
    const rows = await xlsxAdapter.parseChunk(source, { sheet: "Listings", cursor: 0, limit: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.raw).toMatchObject({ title: "Contained Excel rental", price: 8500, latitude: -26.20227 });
    expect(await xlsxAdapter.parseChunk(source, { sheet: "Listings", cursor: 1, limit: 1 })).toEqual([]);
    await expect(xlsxAdapter.parseChunk(source, { sheet: "Missing", cursor: 0, limit: 1 })).rejects.toThrow(/worksheet.*not found/i);
  });
});
