import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getSupabaseEnv: () => ({ supabaseUrl: "https://catalogue.example", supabaseAnonKey: "public-test-key" }) }));
import { readLocationCatalogue, searchLocationCatalogue } from "./catalogue";
import { catalogueResponseSchema, locationSearchWords } from "./catalogue-contract";
const row = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", provider_id: "geonames:953781", name: "Soweto",
  region: "Johannesburg, Gauteng, South Africa", full_address: "Soweto, Johannesburg, South Africa",
  center_lat: -26.27, center_lng: 27.86, west: 27.80, south: -26.32, east: 27.92, north: -26.22,
  extent_kind: "viewport",
};
let urls: URL[];
beforeEach(() => {
  urls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(new URL(String(input)));
    expect(init?.method ?? "GET").toBe("GET");
    expect(new Headers(init?.headers).get("apikey")).toBe("public-test-key");
    return new Response(JSON.stringify([row]), { headers: { "Content-Type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());
it("uses the public read-only search RPC without geocoding or catalogue writes", async () => {
  const result = await searchLocationCatalogue("Soweto");
  expect(result.data.places[0]).toMatchObject({ id: row.id, extentKind: "viewport" });
  expect(urls).toHaveLength(1);
  expect(urls[0]?.pathname).toBe("/rest/v1/rpc/search_discovery_places");
  expect(urls[0]?.searchParams.get("search_query")).toBe("Soweto");
});
it("keeps server-ranked typo matches even when the displayed label differs", async () => {
  expect((await searchLocationCatalogue("Sowteo")).data.places[0]?.label).toBe("Soweto");
  expect(urls[0]?.searchParams.get("search_query")).toBe("Sowteo");
  expect(locationSearchWords('Cape%),id.neq."attack"')).toEqual(["cape", "id", "neq", "attack"]);
  expect((await searchLocationCatalogue("_%()")).data.places).toEqual([]);
});
it("preserves server ranking and resolves recent IDs in saved order", async () => {
  const second = { ...row, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Soweto East" };
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const rows = url.pathname.endsWith("read_discovery_places") ? [row, second] : [second, row];
    return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
  }));
  const result = await searchLocationCatalogue("Sowe", [second.id, row.id, row.id]);
  expect(result.data.places.map(place => place.label)).toEqual(["Soweto East", "Soweto"]);
  expect(result.data.recentPlaces.map(place => place.id)).toEqual([second.id, row.id]);
});
it("rehydrates extent metadata and rejects oversized recent reads", async () => {
  expect((await readLocationCatalogue([row.id]))[0]?.extentKind).toBe("viewport");
  await expect(readLocationCatalogue(Array(7).fill(row.id))).rejects.toThrow("six");
});
it("validates stored geometry and reports failed reads rather than an empty catalogue", async () => {
  const result = await searchLocationCatalogue("");
  expect(catalogueResponseSchema.safeParse({ data: { places: [{ ...result.data.places[0], center: { lat: 0, lng: 0 } }] } }).success).toBe(false);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "database failure" }), { status: 503 })));
  await expect(searchLocationCatalogue("Sowe")).rejects.toMatchObject({ message: "database failure" });
});
