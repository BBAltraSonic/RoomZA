import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { countPaymentRecords } from "./retention";

const userId = "10000000-0000-4000-8000-000000000001";

function clientReturning(result: { count: number | null; error: { code: string } | null }) {
  const or = vi.fn(async () => result);
  const select = vi.fn(() => ({ or }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, or };
}

describe("countPaymentRecords", () => {
  it("should count deposits where the person paid or was paid", async () => {
    const { client, from, select, or } = clientReturning({ count: 2, error: null });
    await expect(countPaymentRecords(client, userId)).resolves.toBe(2);
    expect(from).toHaveBeenCalledWith("payments");
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(or).toHaveBeenCalledWith(`renter_id.eq.${userId},owner_id.eq.${userId}`);
  });

  it("should throw rather than report none when the records cannot be read", async () => {
    const { client } = clientReturning({ count: null, error: { code: "XX000" } });
    await expect(countPaymentRecords(client, userId)).rejects.toThrow();
  });

  it("should refuse an id that is not a uuid before building a filter from it", async () => {
    const { client, from } = clientReturning({ count: 0, error: null });
    await expect(countPaymentRecords(client, "x,owner_id.neq.null")).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});
