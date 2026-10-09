// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ touch: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({ rpc: mocks.touch }) }));
import { HEARTBEAT_MS, usePresenceHeartbeat } from "./use-presence";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("ambient presence failures", () => {
  it("contains cancelled/network heartbeat failures and retries on its next normal cadence", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    mocks.touch.mockRejectedValue(new Error("network error"));
    const { unmount } = renderHook(() => usePresenceHeartbeat());
    await act(async () => { await Promise.resolve(); });
    expect(mocks.touch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(HEARTBEAT_MS); });
    expect(mocks.touch).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(HEARTBEAT_MS); });
    expect(mocks.touch).toHaveBeenCalledTimes(2);
  });
});
