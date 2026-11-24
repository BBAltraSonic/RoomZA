import { describe, expect, it } from "vitest";
import { createBrowserClient, createServerClient } from "./supabase-ssr";
import { BlobReader, ZipReader } from "./zip";

describe("SSR-layer stand-ins for browser-only packages", () => {
  it("should let client components create the Supabase browser client during render", () => {
    expect(() => createBrowserClient("https://example.supabase.co", "anon")).not.toThrow();
  });

  it("should throw loudly when the browser client is used on the server", () => {
    const client = createBrowserClient<{ auth: unknown }>("https://example.supabase.co", "anon");
    expect(() => client.auth).toThrow(/cannot be used while server-rendering/);
  });

  it("should not look like a promise, so awaiting or returning it stays safe", async () => {
    const client = createBrowserClient<object>("https://example.supabase.co", "anon");
    expect(await Promise.resolve(client)).toBe(client);
  });

  it("should refuse to create a server client from a client component", () => {
    expect(() => createServerClient()).toThrow(/cannot be used while server-rendering/);
  });

  it("should refuse to read zip files on the server", () => {
    expect(() => new BlobReader()).toThrow(/only available in the browser/);
    expect(() => new ZipReader()).toThrow(/only available in the browser/);
  });
});
