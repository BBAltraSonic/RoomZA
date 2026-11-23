import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

import DashboardPage from "./page";

beforeEach(() => redirect.mockReset());

describe("/dashboard", () => {
  it("should_send_old_links_to_the_property_view_of_my_listings", async () => {
    await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(redirect).toHaveBeenCalledWith("/post/listings?category=property");
  });

  it("should_keep_search_status_and_sort_but_drop_unknown_params", async () => {
    await DashboardPage({ searchParams: Promise.resolve({ q: "garden", status: "draft", sort: "applicants", other: "x", category: "events" }) });
    const target = new URL(redirect.mock.calls[0]![0] as string, "http://localhost");
    expect(target.pathname).toBe("/post/listings");
    expect(Object.fromEntries(target.searchParams)).toEqual({ category: "property", q: "garden", status: "draft", sort: "applicants" });
  });
});
