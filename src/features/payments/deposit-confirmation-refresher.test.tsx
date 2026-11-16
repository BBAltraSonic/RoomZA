// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { DepositConfirmationRefresher } from "./deposit-confirmation-refresher";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("should re-read the page every few seconds and give up after two minutes", () => {
  vi.useFakeTimers();
  render(<DepositConfirmationRefresher />);

  act(() => vi.advanceTimersByTime(2_999));
  expect(mocks.refresh).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);

  act(() => vi.advanceTimersByTime(10 * 60_000));
  expect(mocks.refresh).toHaveBeenCalledTimes(40);
});

it("should stop refreshing once the deposit is confirmed and the refresher is removed", () => {
  vi.useFakeTimers();
  const { unmount } = render(<DepositConfirmationRefresher />);
  act(() => vi.advanceTimersByTime(3_000));
  unmount();
  act(() => vi.advanceTimersByTime(60_000));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
