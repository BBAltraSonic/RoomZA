import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createZipArchive } from "./zip-archive";

async function readBack(archive: Uint8Array) {
  return JSZip.loadAsync(archive, { checkCRC32: true });
}

describe("createZipArchive", () => {
  it("should_round_trip_text_and_binary_entries_with_valid_checksums", async () => {
    const binary = new Uint8Array(4096).map((_, index) => (index * 31) % 256);
    const archive = await createZipArchive([
      { name: "pinpoint-data.json", data: JSON.stringify({ hello: "world" }, null, 2) },
      { name: "files/listing-images/a-photo.jpg", data: binary },
    ]);

    const zip = await readBack(archive);

    expect(Object.keys(zip.files).sort()).toEqual(["files/listing-images/a-photo.jpg", "pinpoint-data.json"]);
    expect(await zip.file("pinpoint-data.json")!.async("string")).toBe('{\n  "hello": "world"\n}');
    expect(await zip.file("files/listing-images/a-photo.jpg")!.async("uint8array")).toEqual(binary);
  });

  it("should_compress_repetitive_content", async () => {
    const text = "deposit ".repeat(10_000);

    const archive = await createZipArchive([{ name: "big.txt", data: text }]);

    expect(archive.byteLength).toBeLessThan(text.length / 10);
    expect(await (await readBack(archive)).file("big.txt")!.async("string")).toBe(text);
  });

  it("should_store_incompressible_and_empty_entries", async () => {
    const random = crypto.getRandomValues(new Uint8Array(2048));

    const zip = await readBack(await createZipArchive([
      { name: "random.bin", data: random },
      { name: "empty.txt", data: "" },
    ]));

    expect(await zip.file("random.bin")!.async("uint8array")).toEqual(random);
    expect(await zip.file("empty.txt")!.async("string")).toBe("");
  });

  it("should_keep_non_ascii_file_names", async () => {
    const zip = await readBack(await createZipArchive([{ name: "files/café-plan.txt", data: "ok" }]));

    expect(Object.keys(zip.files)).toEqual(["files/café-plan.txt"]);
  });

  it("should_produce_an_empty_archive_when_given_no_entries", async () => {
    const zip = await readBack(await createZipArchive([]));

    expect(Object.keys(zip.files)).toEqual([]);
  });
});
