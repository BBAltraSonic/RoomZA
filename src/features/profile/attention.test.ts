import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAttentionItems, getAttentionItems } from "./attention";

describe("buildAttentionItems", () => {
  it("should_list_only_things_waiting_on_the_person_with_plain_counts", () => {
    expect(buildAttentionItems({ applicationsToReview: 2, approvedApplications: 0, bookedViewings: 1 })).toEqual([
      { key: "applicationsToReview", label: "2 applications to review", href: "/dashboard/applicants" },
      { key: "bookedViewings", label: "1 viewing booked", href: "/viewings" },
    ]);
  });

  it("should_use_singular_and_plural_wording", () => {
    expect(buildAttentionItems({ applicationsToReview: 1, approvedApplications: 3, bookedViewings: 2 }).map(item => item.label)).toEqual([
      "1 application to review", "3 approved applications to follow up", "2 viewings booked",
    ]);
  });

  it("should_be_empty_when_nothing_is_waiting", () => {
    expect(buildAttentionItems({ applicationsToReview: 0, approvedApplications: 0, bookedViewings: 0 })).toEqual([]);
  });
});

type Result = { count: number | null; error: object | null };

/** A chainable stand-in for the Supabase query builder that records every filter. */
function fakeClient(results: Result[]) {
  const calls: { table: string; select: unknown[]; filters: unknown[][] }[] = [];
  let index = 0;
  const client = {
    from: vi.fn((table: string) => {
      const call = { table, select: [] as unknown[], filters: [] as unknown[][] };
      calls.push(call);
      const result = results[index++]!;
      const builder: Record<string, unknown> = {
        select: (...args: unknown[]) => { call.select = args; return builder; },
        eq: (...args: unknown[]) => { call.filters.push(["eq", ...args]); return builder; },
        in: (...args: unknown[]) => { call.filters.push(["in", ...args]); return builder; },
        then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("getAttentionItems", () => {
  it("should_count_owner_reviews_renter_approvals_and_booked_viewings", async () => {
    const { client, calls } = fakeClient([
      { count: 2, error: null }, { count: 1, error: null }, { count: 1, error: null }, { count: 0, error: null },
    ]);
    const result = await getAttentionItems(client, "me");
    expect(result.incomplete).toBe(false);
    expect(result.items.map(item => item.label)).toEqual(["2 applications to review", "1 approved application to follow up", "1 viewing booked"]);
    expect(calls.map(call => [call.table, call.select[0], call.filters])).toEqual([
      ["applications", "id,listings!inner(landlord_id)", [["eq", "listings.landlord_id", "me"], ["in", "status", ["submitted", "under_review"]]]],
      ["applications", "id", [["eq", "renter_id", "me"], ["eq", "status", "approved"]]],
      ["viewings", "id,applications!inner(renter_id)", [["eq", "applications.renter_id", "me"], ["eq", "status", "booked"]]],
      ["viewings", "id,buyer_interests!inner(buyer_id)", [["eq", "buyer_interests.buyer_id", "me"], ["eq", "status", "booked"]]],
    ]);
  });

  it("should_keep_what_loaded_and_say_when_something_did_not", async () => {
    const { client } = fakeClient([
      { count: null, error: { code: "PGRST100" } }, { count: 0, error: null }, { count: 2, error: null }, { count: null, error: { code: "x" } },
    ]);
    const result = await getAttentionItems(client, "me");
    expect(result.incomplete).toBe(true);
    expect(result.items.map(item => item.label)).toEqual(["2 viewings booked"]);
  });
});
