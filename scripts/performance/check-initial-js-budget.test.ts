import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  checkInitialJsBudget,
  collectRouteInitialChunks,
  gzipSize,
  measureInitialJsBytes,
} from "./check-initial-js-budget.mjs";

/**
 * Builds a synthetic `.next` build output so the budget check can be exercised
 * without running a full production build. Mirrors the real layout the script
 * reads: `build-manifest.json` (rootMainFiles), a route client-reference
 * manifest under `server/app`, and chunk files under `static/chunks`.
 */
function scaffoldNext(nextDir: {
  rootMainFiles: string[];
  routeChunks: string[];
  chunkContents: Record<string, Buffer>;
  route?: "root" | "listings";
}) {
  const dir = mkdtempSync(path.join(tmpdir(), "next-budget-"));

  // build-manifest.json with shared root main files.
  writeFileSync(
    path.join(dir, "build-manifest.json"),
    JSON.stringify({ rootMainFiles: nextDir.rootMainFiles }),
  );

  // Route client-reference manifest referencing the route-specific chunks.
  const appDir =
    nextDir.route === "listings"
      ? path.join(dir, "server", "app", "listings")
      : path.join(dir, "server", "app");
  mkdirSync(appDir, { recursive: true });
  const manifestBody = nextDir.routeChunks
    .map((chunk) => `"${chunk}"`)
    .join(",");
  writeFileSync(
    path.join(appDir, "page_client-reference-manifest.js"),
    `self.__RSC_MANIFEST = {chunks:[${manifestBody}]};`,
  );

  // Chunk files under .next/static/chunks.
  for (const [chunk, contents] of Object.entries(nextDir.chunkContents)) {
    const filePath = path.join(dir, chunk.replaceAll("/", path.sep));
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }

  return dir;
}

describe("check-initial-js-budget", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("gzipSize returns the compressed byte length", () => {
    const buffer = Buffer.from("a".repeat(10_000));
    expect(gzipSize(buffer)).toBe(gzipSync(buffer, { level: 9 }).length);
    expect(gzipSize(buffer)).toBeLessThan(buffer.length);
  });

  it("collects shared root chunks plus route chunks for the root route", () => {
    tempDir = scaffoldNext({
      rootMainFiles: ["static/chunks/main-app.js"],
      routeChunks: ["static/chunks/page-home.js"],
      chunkContents: {
        "static/chunks/main-app.js": Buffer.from("x"),
        "static/chunks/page-home.js": Buffer.from("y"),
      },
    });

    const chunks = collectRouteInitialChunks(tempDir, "/");
    expect(chunks).toEqual([
      "static/chunks/main-app.js",
      "static/chunks/page-home.js",
    ]);
  });

  it("returns null when the requested route has no manifest", () => {
    tempDir = scaffoldNext({
      rootMainFiles: [],
      routeChunks: [],
      chunkContents: {},
    });

    expect(collectRouteInitialChunks(tempDir, "/does-not-exist")).toBeNull();
    expect(measureInitialJsBytes(tempDir, "/does-not-exist")).toBeNull();
  });

  it("passes when the compressed initial JS is within the 300 KB budget", () => {
    // Highly compressible content keeps the gzip size well under budget.
    const small = Buffer.from("a".repeat(50_000));
    tempDir = scaffoldNext({
      rootMainFiles: ["static/chunks/main-app.js"],
      routeChunks: ["static/chunks/page-home.js"],
      chunkContents: {
        "static/chunks/main-app.js": small,
        "static/chunks/page-home.js": small,
      },
    });

    const result = checkInitialJsBudget({ nextDir: tempDir, budgetKb: 300 });
    expect(result.found).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.compressedKb).toBeLessThan(300);
  });

  it("fails when the compressed initial JS exceeds the budget", () => {
    // Incompressible random bytes so gzip cannot shrink below the budget.
    const incompressible = Buffer.from(
      Array.from({ length: 400 * 1024 }, () => Math.floor(Math.random() * 256)),
    );
    tempDir = scaffoldNext({
      rootMainFiles: ["static/chunks/main-app.js"],
      routeChunks: [],
      chunkContents: {
        "static/chunks/main-app.js": incompressible,
      },
    });

    const result = checkInitialJsBudget({ nextDir: tempDir, budgetKb: 300 });
    expect(result.found).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.compressedKb).toBeGreaterThan(300);
  });

  it("sums per-chunk gzip sizes across all initial chunks", () => {
    const chunkA = Buffer.from("a".repeat(20_000));
    const chunkB = Buffer.from("b".repeat(20_000));
    tempDir = scaffoldNext({
      rootMainFiles: ["static/chunks/main-app.js"],
      routeChunks: ["static/chunks/page-home.js"],
      chunkContents: {
        "static/chunks/main-app.js": chunkA,
        "static/chunks/page-home.js": chunkB,
      },
    });

    const measurement = measureInitialJsBytes(tempDir, "/");
    expect(measurement).not.toBeNull();
    expect(measurement!.compressedBytes).toBe(
      gzipSize(chunkA) + gzipSize(chunkB),
    );
    expect(measurement!.chunks).toHaveLength(2);
  });
});
