import { describe, expect, it } from "vitest";

import { validateArchiveEntries } from "./adapters/archive-safety";
import { matchImages } from "./image-matching";
import { isPublicAddress, parseSafeImageUrl } from "./safe-image-url";

describe("listing import asset safety", () => {
  it("rejects traversal, oversized images, unsupported entries, and ZIP-bomb ratios", () => {
    const result = validateArchiveEntries([
      { filename: "../secret.jpg", compressedSize: 100, uncompressedSize: 1_000 },
      { filename: "listing/script.exe", compressedSize: 100, uncompressedSize: 1_000 },
      { filename: "listing/photo.jpg", compressedSize: 10, uncompressedSize: 2_000 },
      { filename: "listing/huge.png", compressedSize: 1_000_000, uncompressedSize: 11 * 1024 * 1024 },
    ]);
    expect(result.safe).toBe(false);
    expect(result.issues.join(" ")).toMatch(/Unsafe archive path/);
    expect(result.issues.join(" ")).toMatch(/Suspicious compression ratio/);
    expect(result.issues.join(" ")).toMatch(/exceeds 10 MB/);
  });

  it("uses explicit names before source folders and filename prefixes", () => {
    const result = matchImages(
      { explicit: ["cover.jpg"], sourceReference: "P-100" },
      [
        { id: "cover", filename: "cover.jpg" },
        { id: "folder", filename: "kitchen.jpg", sourceReferenceFolder: "P-100" },
        { id: "prefix", filename: "P-100-bedroom.jpg" },
        { id: "other", filename: "other.jpg" },
      ],
    );
    expect(result.matched.map((item) => [item.id, item.method])).toEqual([
      ["cover", "explicit"],
      ["folder", "source_reference"],
      ["prefix", "prefix"],
    ]);
    expect(result.unmatched.map((item) => item.id)).toEqual(["other"]);
  });

  it("keeps ambiguous explicit matches unattached", () => {
    const result = matchImages(
      { explicit: ["photo.jpg"] },
      [{ id: "a", filename: "photo.jpg" }, { id: "b", filename: "PHOTO.JPG" }],
    );
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(2);
  });

  it("rejects private-network and unsafe image URL targets", () => {
    expect(() => parseSafeImageUrl("http://images.example.com/a.jpg")).toThrow(/HTTPS/);
    expect(() => parseSafeImageUrl("https://localhost/a.jpg")).toThrow(/not allowed/);
    expect(() => parseSafeImageUrl("https://user:pass@images.example.com/a.jpg")).toThrow(/credentials/);
    expect(isPublicAddress("127.0.0.1")).toBe(false);
    expect(isPublicAddress("10.1.2.3")).toBe(false);
    expect(isPublicAddress("169.254.169.254")).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("::1")).toBe(false);
  });
});
