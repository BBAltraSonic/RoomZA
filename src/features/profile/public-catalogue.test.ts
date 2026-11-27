import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  posterIds: {} as Record<string, string[]>,
  anonRows: {} as Record<string, unknown[]>,
  anonTables: [] as string[],
  adminTables: [] as string[],
  rpc: vi.fn(),
  fail: false,
}));

function query(rows: () => unknown[], onError = () => state.fail) {
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "order", "limit", "in", "is"]) chain[name] = () => chain;
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve(onError() ? { data: null, error: new Error("read failed") } : { data: rows(), error: null });
  return chain;
}

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/env", () => ({ getSupabaseEnv: () => ({ supabaseUrl: "http://db", supabaseAnonKey: "anon" }) }));
vi.mock("@/features/discovery/presentation-data", () => ({ enrichDiscoveryItems: async (items: unknown[]) => items }));
vi.mock("@/lib/supabase/admin", () => ({
  createUntypedClient: () => ({
    from: (table: string) => {
      state.adminTables.push(table);
      return query(() => (state.posterIds[table] ?? []).map((id) => ({ id })));
    },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, key: string) => {
    expect(key).toBe("anon");
    return {
      from: (table: string) => {
        state.anonTables.push(table);
        return query(() => state.anonRows[table] ?? []);
      },
      rpc: state.rpc,
    };
  },
}));

import { getPublicProfileCatalogue } from "./public-catalogue";

const AREA = "33333333-3333-4333-8333-333333333333";
const ENTRY = "55555555-5555-4555-8555-555555555555";
const OFFER = "66666666-6666-4666-8666-666666666666";
const later = new Date(Date.now() + 7 * 86400000).toISOString();
const earlier = new Date(Date.now() - 86400000).toISOString();

beforeEach(() => {
  state.posterIds = {};
  state.anonRows = {};
  state.anonTables = [];
  state.adminTables = [];
  state.fail = false;
  state.rpc.mockReset();
});

describe("getPublicProfileCatalogue", () => {
  it("reads published items only through public, RLS-checked paths", async () => {
    state.posterIds = { pinpoint_entries: [ENTRY], shopping_offers: [OFFER] };
    state.anonRows = {
      approved_entry_specials: [
        { id: ENTRY, category: "event", approved_at: earlier, content: { title: "Open house", description: "Come see", venueName: "4th Ave", areaId: AREA, address: "Parkhurst", latitude: -26.1, longitude: 28.0, startsAt: later, endsAt: later.replace(/T.*/, "T23:00:00.000Z") } },
      ],
    };
    state.rpc.mockResolvedValue({ data: { status: "unavailable", serverNow: earlier }, error: null });

    const result = await getPublicProfileCatalogue("11111111-1111-4111-8111-111111111111");

    expect(result.status).toBe("ready");
    expect(result.specials).toMatchObject([{ id: ENTRY, kind: "event", state: "upcoming" }]);
    // Owner tables only map the poster to ids; content always comes from public reads.
    expect(state.adminTables.sort()).toEqual(["pinpoint_entries", "shopping_offers"]);
    expect(state.anonTables.sort()).toEqual(["approved_entry_specials"]);
    expect(state.rpc).toHaveBeenCalledWith("pinpoint_offer_public_detail", { target: OFFER });
  });

  it("skips public reads entirely when the member has posted nothing", async () => {
    const result = await getPublicProfileCatalogue("11111111-1111-4111-8111-111111111111");
    expect(result).toEqual({ status: "ready", specials: [] });
    expect(state.anonTables).toEqual([]);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("reports a failed read as unavailable instead of an empty catalogue", async () => {
    state.fail = true;
    const result = await getPublicProfileCatalogue("11111111-1111-4111-8111-111111111111");
    expect(result).toEqual({ status: "unavailable", specials: [] });
  });
});
