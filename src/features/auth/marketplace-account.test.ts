import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ensureMarketplaceAccount } from "./marketplace-account";

describe("shared marketplace account setup", () => {
  it("uses a self-only RPC without supplied identity or privileges", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    expect(await ensureMarketplaceAccount({ rpc } as unknown as SupabaseClient<Database>)).toEqual({ error: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ensure_marketplace_account");
  });
  it("returns failures for an explicit retry", async () => {
    const error = { code: "42501", message: "Inactive session" };
    const rpc = vi.fn().mockResolvedValue({ error });
    expect(await ensureMarketplaceAccount({ rpc } as unknown as SupabaseClient<Database>)).toEqual({ error });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
