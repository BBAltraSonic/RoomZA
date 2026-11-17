import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { minifyCloudflareServer } from "./minify-cloudflare-server.mjs";

const VERBOSE_HANDLER = `
// A comment that the packaging pass should drop.
function describeListingPrice(listingPriceInRand, depositAmountInRand) {
  const totalMoveInCost = listingPriceInRand + depositAmountInRand;
  return "Move-in total: " + totalMoveInCost;
}

class ListingSummary {
  constructor(listingTitle) {
    this.listingTitle = listingTitle;
  }
}

export const handler = { describeListingPrice, ListingSummary };
`;

describe("minify-cloudflare-server", () => {
  const temporaryPaths: string[] = [];

  afterEach(() => {
    for (const temporaryPath of temporaryPaths.splice(0)) {
      rmSync(temporaryPath, { recursive: true, force: true });
    }
  });

  function handlerFile(contents: string) {
    const directory = mkdtempSync(path.join(tmpdir(), "cloudflare-server-minify-"));
    temporaryPaths.push(directory);
    const handlerPath = path.join(directory, "handler.mjs");
    writeFileSync(handlerPath, contents);
    return handlerPath;
  }

  it("should shrink the handler in place and report both sizes", async () => {
    const handlerPath = handlerFile(VERBOSE_HANDLER);

    const result = await minifyCloudflareServer({ handlerPath });

    expect(result.bytesBefore).toBe(Buffer.byteLength(VERBOSE_HANDLER));
    expect(result.bytesAfter).toBe(Buffer.byteLength(readFileSync(handlerPath)));
    expect(result.bytesAfter).toBeLessThan(result.bytesBefore);
    expect(readFileSync(handlerPath, "utf8")).not.toContain("A comment");
  });

  it("should keep the handler a working module with its class names", async () => {
    const handlerPath = handlerFile(VERBOSE_HANDLER);

    await minifyCloudflareServer({ handlerPath });
    const { handler } = await import(/* @vite-ignore */ pathToFileURL(handlerPath).href);

    expect(handler.describeListingPrice(4500, 4500)).toBe("Move-in total: 9000");
    expect(handler.ListingSummary.name).toBe("ListingSummary");
  });

  it("should shorten function names to save Worker size", async () => {
    const handlerPath = handlerFile(VERBOSE_HANDLER);

    await minifyCloudflareServer({ handlerPath });

    expect(readFileSync(handlerPath, "utf8")).not.toContain("describeListingPrice(");
  });

  it("should fail with a build hint when the handler has not been built", async () => {
    const handlerPath = path.join(tmpdir(), "missing-cloudflare-handler.mjs");

    await expect(minifyCloudflareServer({ handlerPath })).rejects.toThrow(
      /opennextjs-cloudflare build/,
    );
  });

  it("should leave the handler untouched when it cannot be parsed", async () => {
    const brokenHandler = "export const handler = {;";
    const handlerPath = handlerFile(brokenHandler);

    await expect(minifyCloudflareServer({ handlerPath })).rejects.toThrow();
    expect(readFileSync(handlerPath, "utf8")).toBe(brokenHandler);
  });
});
