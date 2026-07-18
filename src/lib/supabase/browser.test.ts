import { describe, expect, it } from "vitest";

import { resolveBrowserSupabaseUrl } from "./browser";

describe("resolveBrowserSupabaseUrl", () => {
  it("keeps loopback Supabase on the desktop browser", () => {
    expect(resolveBrowserSupabaseUrl("http://127.0.0.1:54321", "localhost")).toBe(
      "http://127.0.0.1:54321",
    );
  });

  it("routes loopback Supabase through the page host for phone testing", () => {
    expect(resolveBrowserSupabaseUrl("http://127.0.0.1:54321", "100.69.40.103")).toBe(
      "http://100.69.40.103:54321",
    );
  });

  it("does not rewrite hosted Supabase projects", () => {
    expect(resolveBrowserSupabaseUrl("https://project.supabase.co", "roomza.example")).toBe(
      "https://project.supabase.co",
    );
  });
});
