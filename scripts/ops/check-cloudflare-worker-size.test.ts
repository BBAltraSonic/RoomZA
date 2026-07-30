import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  checkCloudflareWorkerSize,
  gzipSize,
} from "./check-cloudflare-worker-size.mjs";

describe("check-cloudflare-worker-size", () => {
  const temporaryPaths: string[] = [];

  afterEach(() => {
    for (const temporaryPath of temporaryPaths.splice(0)) {
      rmSync(temporaryPath, { recursive: true, force: true });
    }
  });

  function workerFile(contents: Buffer) {
    const directory = mkdtempSync(path.join(tmpdir(), "cloudflare-worker-size-"));
    temporaryPaths.push(directory);
    const filePath = path.join(directory, "worker.js");
    writeFileSync(filePath, contents);
    return filePath;
  }

  it("passes when the gzip-compressed worker fits within the budget", () => {
    const workerPath = workerFile(Buffer.from("a".repeat(20_000)));
    const result = checkCloudflareWorkerSize({ workerPath, budgetBytes: 1024 });

    expect(result.found).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.compressedBytes).toBe(gzipSize(Buffer.from("a".repeat(20_000))));
  });

  it("fails when the gzip-compressed worker exceeds the budget", () => {
    const workerPath = workerFile(Buffer.from(Array.from({ length: 4_096 }, (_, index) => index % 256)));
    const result = checkCloudflareWorkerSize({ workerPath, budgetBytes: 100 });

    expect(result.found).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.compressedBytes).toBeGreaterThan(result.budgetBytes);
  });

  it("fails when Wrangler has not produced a worker artifact", () => {
    const result = checkCloudflareWorkerSize({
      workerPath: path.join(tmpdir(), "missing-cloudflare-worker.js"),
    });

    expect(result.found).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.compressedBytes).toBeNull();
  });
});
