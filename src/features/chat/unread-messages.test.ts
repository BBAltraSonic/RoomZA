// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUnreadMessageCount, useUnreadMessageCount, type UnreadMessageClient } from "./unread-messages";

const browserClient = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => browserClient.current }));

function fakeClient({ userId = "user-1", count = 3, error = null }: { userId?: string | null; count?: number | null; error?: unknown } = {}) {
  const calls: { select?: unknown[]; is?: unknown[]; neq?: unknown[] } = {};
  const query = {
    select: vi.fn((...args: unknown[]) => { calls.select = args; return query; }),
    is: vi.fn((...args: unknown[]) => { calls.is = args; return query; }),
    neq: vi.fn((...args: unknown[]) => { calls.neq = args; return Promise.resolve({ count, error }); }),
  };
  const client = {
    auth: { getSession: vi.fn(async () => ({ data: { session: userId ? { user: { id: userId } } : null } })) },
    from: vi.fn(() => query),
  };
  return { client: client as unknown as UnreadMessageClient, calls, from: client.from };
}

afterEach(cleanup);

describe("fetchUnreadMessageCount", () => {
  it("should_count_unread_messages_sent_by_other_people", async () => {
    const { client, calls, from } = fakeClient({ count: 4 });

    await expect(fetchUnreadMessageCount(client)).resolves.toBe(4);

    expect(from).toHaveBeenCalledWith("messages");
    expect(calls.select).toEqual(["id", { count: "exact", head: true }]);
    expect(calls.is).toEqual(["read_at", null]);
    expect(calls.neq).toEqual(["sender_id", "user-1"]);
  });

  it("should_return_zero_without_querying_when_signed_out", async () => {
    const { client, from } = fakeClient({ userId: null });

    await expect(fetchUnreadMessageCount(client)).resolves.toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("should_return_null_when_the_query_fails", async () => {
    const { client } = fakeClient({ error: { message: "boom" } });

    await expect(fetchUnreadMessageCount(client)).resolves.toBeNull();
  });
});

describe("useUnreadMessageCount", () => {
  beforeEach(() => { browserClient.current = fakeClient({ count: 2 }).client; });

  it("should_load_the_count_when_enabled", async () => {
    const { result } = renderHook(() => useUnreadMessageCount(true, "/"));
    await waitFor(() => expect(result.current).toBe(2));
  });

  it("should_stay_at_zero_when_disabled", async () => {
    const { result } = renderHook(() => useUnreadMessageCount(false, "/"));
    await act(async () => {});
    expect(result.current).toBe(0);
  });

  it("should_reload_when_the_refresh_key_changes", async () => {
    const { result, rerender } = renderHook(({ key }) => useUnreadMessageCount(true, key), { initialProps: { key: "/" } });
    await waitFor(() => expect(result.current).toBe(2));

    browserClient.current = fakeClient({ count: 0 }).client;
    rerender({ key: "/messages" });

    await waitFor(() => expect(result.current).toBe(0));
  });

  it("should_keep_the_last_count_when_a_reload_fails", async () => {
    const { result, rerender } = renderHook(({ key }) => useUnreadMessageCount(true, key), { initialProps: { key: "/" } });
    await waitFor(() => expect(result.current).toBe(2));

    browserClient.current = fakeClient({ error: { message: "offline" } }).client;
    rerender({ key: "/saved" });
    await act(async () => {});

    expect(result.current).toBe(2);
  });
});
