import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";
import { enrollSignupPersona } from "./signup-persona";

function setup(existing: Array<{ persona: string; is_active: boolean }> = [], failure?: "read" | "details" | "insert") {
  const error = { message: "Database unavailable" };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(async () => ({ data: existing, error: failure === "read" ? error : null })),
    upsert: vi.fn(async () => ({ error: failure === "details" ? error : null })),
    insert: vi.fn(async () => ({ error: failure === "insert" ? error : null })),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient<Database>, from, query, error };
}

describe("signup persona enrollment", () => {
  it.each([undefined, null, "admin", "owner", "reviewer"])("ignores invalid metadata preference %s", async (preference) => {
    const { client, from } = setup();
    expect(await enrollSignupPersona(client, "user-1", preference)).toEqual({ persona: null, error: null });
    expect(from).not.toHaveBeenCalled();
  });

  it("preserves existing personas and the active role when signup metadata changes", async () => {
    const { client, query } = setup([{ persona: "landlord", is_active: false }, { persona: "buyer", is_active: true }]);
    expect(await enrollSignupPersona(client, "user-1", "seller")).toEqual({ persona: "buyer", error: null });
    expect(query.insert).not.toHaveBeenCalled();
    expect(query.upsert).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("profile_id", "user-1");
  });

  it.each(["read", "details", "insert"] as const)("reports a %s failure instead of claiming enrollment succeeded", async (failure) => {
    const { client, query, error } = setup([], failure);
    expect(await enrollSignupPersona(client, "user-1", "seller")).toEqual({ persona: null, error });
    if (failure !== "insert") expect(query.insert).not.toHaveBeenCalled();
  });
});
