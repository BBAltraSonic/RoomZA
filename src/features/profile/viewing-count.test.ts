import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfileViewingCount } from "./viewing-count";

describe("profile viewing counts", () => {
  function client(results: { count: number | null; error: object | null }[]) {
    const filters: unknown[][] = [];
    const selections: unknown[][] = [];
    let index = 0;
    return { filters, selections, value: { from: vi.fn(() => ({ select: (...args: unknown[]) => {
      selections.push(args);
      return { eq: (...filter: unknown[]) => { filters.push(filter); return Promise.resolve(results[index++]); } };
    } })) } as unknown as SupabaseClient };
  }
  it("counts rental and purchase appointments using supported scoped inner joins", async () => {
    const mock = client([{ count: 2, error: null }, { count: 3, error: null }]);
    expect(await getProfileViewingCount(mock.value, "current-user")).toBe(5);
    expect(mock.filters).toEqual([["applications.renter_id", "current-user"], ["buyer_interests.buyer_id", "current-user"]]);
    expect(mock.selections).toEqual([
      ["id,applications!inner(renter_id)", { count: "exact", head: true }],
      ["id,buyer_interests!inner(buyer_id)", { count: "exact", head: true }],
    ]);
  });
  it("distinguishes a failed count from a real empty schedule", async () => {
    expect(await getProfileViewingCount(client([{ count: null, error: { code: "PGRST100" } }, { count: 3, error: null }]).value, "user")).toBeNull();
    expect(await getProfileViewingCount(client([{ count: 0, error: null }, { count: 0, error: null }]).value, "user")).toBe(0);
  });
});
