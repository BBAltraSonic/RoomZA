// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useLatestRead } from "./use-latest-read";
afterEach(cleanup);
describe("read ownership", () => {
  it("aborts earlier reads, even when transport ignores cancellation", () => {
    const { result, unmount } = renderHook(() => useLatestRead("scope"));
    const old = result.current();
    const current = result.current();
    expect(old.signal.aborted).toBe(true);
    expect(current.signal.aborted).toBe(false);
    unmount();
    expect(current.signal.aborted).toBe(true);
    expect(result.current().signal.aborted).toBe(true);
  });
  it("rejects a stale callback after scope navigation", () => {
    const { result, rerender } = renderHook(({scope}) => useLatestRead(scope), { initialProps: { scope: "old" } });
    const beginOld = result.current;
    const old = beginOld();
    act(() => rerender({scope:"new"}));
    expect(old.signal.aborted).toBe(true);
    const current = result.current();
    expect(beginOld().signal.aborted).toBe(true);
    expect(current.signal.aborted).toBe(false);
  });
});
