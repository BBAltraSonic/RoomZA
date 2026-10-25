import JSZip from "jszip";

// Real Open XML bytes, with an intentionally different first worksheet.
export async function importWorkbookBytes() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Instructions" sheetId="1" r:id="rId1"/><sheet name="Listings" sheetId="2" r:id="rId2"/></sheets></workbook>');
  zip.file("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>');
  const sheet = (rows: Array<Array<string | number>>) => '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows.map((row, r) => `<row r="${r + 1}">` + row.map((value, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}"` + (typeof value === "number" ? `><v>${value}</v></c>` : ` t="inlineStr"><is><t>${value}</t></is></c>`)).join("") + "</row>").join("") + "</sheetData></worksheet>";
  zip.file("xl/worksheets/sheet1.xml", sheet([["Instructions"], ["Select Listings"]]));
  zip.file("xl/worksheets/sheet2.xml", sheet([
    ["title", "listingType", "price", "address", "latitude", "longitude"],
    ["Contained Excel rental", "rent", 8500, "Synthetic Johannesburg Excel address", -26.20227, 28.04363],
  ]));
  return zip.generateAsync({ type: "uint8array" });
}
