import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260716204950_listing_title_address_search.sql",
);

describe("listing title/address search RPC migration", () => {
  it("keeps the spatial viewport and filters the literal query against title and address", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("extensions.st_intersects");
    expect(sql).toContain("coalesce(listings.title, '')");
    expect(sql).toContain("coalesce(listings.address, '')");
    expect(sql).toContain("position(lower(btrim(search_query))");
    expect(sql).not.toContain("listings.id::text = btrim(search_query)");
  });
});
