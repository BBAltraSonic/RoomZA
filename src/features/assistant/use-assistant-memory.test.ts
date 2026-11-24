// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyMemory, recordSearch, serializeMemory } from "./memory";
import { useAssistantMemory } from "./use-assistant-memory";

const fetchMock = vi.fn();
const STORAGE_KEY = "pinpoint:assistant-memory:v1";

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useAssistantMemory", () => {
  it("should_keep_a_guests_memory_on_the_device", async () => {
    fetchMock.mockResolvedValue(json(401, { ok: false }));
    const { result } = renderHook(() => useAssistantMemory());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() => result.current.update(recordSearch(emptyMemory(), new URLSearchParams("type=room"))));
    expect(result.current.home).toBe("device");
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("type=room");
  });

  it("should_move_device_memory_into_the_account_and_clear_the_device", async () => {
    window.localStorage.setItem(STORAGE_KEY, serializeMemory(recordSearch(emptyMemory(), new URLSearchParams("beds=2"))));
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json(200, { ok: true }) : json(200, { ok: true, data: { memory: { version: 1, recent: [], preferences: ["quick:furnished"], declined: [] } } }),
    );
    const { result } = renderHook(() => useAssistantMemory());
    await waitFor(() => expect(result.current.home).toBe("account"));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const sent = JSON.parse(put![1].body as string);
    expect(sent.memory.recent.map((entry: { query: string }) => entry.query)).toEqual(["beds=2"]);
    expect(sent.memory.preferences).toEqual(["quick:furnished"]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.memory.recent.map((entry) => entry.query)).toEqual(["beds=2"]);
  });

  it("should_write_account_changes_to_the_server_not_the_device", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json(200, { ok: true }) : json(200, { ok: true, data: { memory: emptyMemory() } }),
    );
    const { result } = renderHook(() => useAssistantMemory());
    await waitFor(() => expect(result.current.home).toBe("account"));
    vi.useFakeTimers();
    act(() => result.current.update(recordSearch(emptyMemory(), new URLSearchParams("type=room"))));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("should_forget_everything_in_the_account", async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true, data: { memory: emptyMemory() } }));
    const { result } = renderHook(() => useAssistantMemory());
    await waitFor(() => expect(result.current.home).toBe("account"));
    act(() => result.current.forgetAll());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
  });

  it("should_keep_working_on_the_device_when_the_account_cannot_be_reached", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    window.localStorage.setItem(STORAGE_KEY, serializeMemory(recordSearch(emptyMemory(), new URLSearchParams("beds=2"))));
    const { result } = renderHook(() => useAssistantMemory());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.home).toBe("device");
    expect(result.current.memory.recent).toHaveLength(1);
  });
});
