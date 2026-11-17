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

  it("should stub Next.js modules the Worker never runs and keep the rest", async () => {
    const handlerPath = handlerFile(`
var __commonJS = (cb, mod) => () => (mod || cb[Object.keys(cb)[0]]((mod = { exports: {} }).exports, mod), mod.exports);
var require_jsonwebtoken = __commonJS({
  ".open-next/server-functions/default/node_modules/next/dist/compiled/jsonwebtoken/index.js"(exports, module) {
    module.exports = { verify: () => "SECRET_JWT_BODY_MARKER" };
  }
});
var require_interceptors = __commonJS({
  ".open-next/server-functions/default/node_modules/next/dist/compiled/@mswjs/interceptors/ClientRequest/index.js"(exports, module) {
    module.exports = { ClientRequestInterceptor: "MSW_BODY_MARKER" };
  }
});
var require_kept = __commonJS({
  ".open-next/server-functions/default/node_modules/next/dist/server/kept.js"(exports, module) {
    module.exports = { answer: 42 };
  }
});
function previewData() {
  try { return require_jsonwebtoken().verify(); } catch { return false; }
}
export const handler = { previewData, kept: () => require_kept().answer, msw: () => require_interceptors() };
`);

    const result = await minifyCloudflareServer({ handlerPath });
    const output = readFileSync(handlerPath, "utf8");
    const { handler } = await import(/* @vite-ignore */ pathToFileURL(handlerPath).href);

    expect(result.stubbedModules).toEqual([
      "next/dist/compiled/jsonwebtoken/index.js",
      "next/dist/compiled/@mswjs/interceptors/ClientRequest/index.js",
    ]);
    expect(output).not.toContain("SECRET_JWT_BODY_MARKER");
    expect(output).not.toContain("MSW_BODY_MARKER");
    expect(handler.previewData()).toBe(false);
    expect(() => handler.msw()).toThrow(/not bundled/i);
    expect(handler.kept()).toBe(42);
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
