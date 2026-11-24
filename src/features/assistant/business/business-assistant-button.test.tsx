// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

const mocks = vi.hoisted(() => ({ getBusinessView: vi.fn() }));
vi.mock("./business-actions", () => mocks);
vi.mock("next/dynamic", () => ({ default: () => function PanelStub({ onClose }: { onClose: () => void }) {
  return <div role="dialog" aria-label="Assistant panel"><button type="button" onClick={onClose}>Close stub</button></div>;
} }));

import { BADGE_REFRESH_MS, BusinessAssistantButton } from "./business-assistant-button";

const today = (badge: number) => ({ success: true, data: { template: "today", items: [], notes: [], reminders: [], badge } });

beforeEach(() => {
  vi.useFakeTimers();
  mocks.getBusinessView.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BusinessAssistantButton", () => {
  it("should_show_a_badge_when_something_needs_the_lister_and_refresh_it", async () => {
    mocks.getBusinessView.mockResolvedValueOnce(today(4)).mockResolvedValue(today(1));
    render(<BusinessAssistantButton />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: /Assistant, 4 things need you/ })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(BADGE_REFRESH_MS);
    });
    expect(screen.getByRole("button", { name: /Assistant, 1 thing needs you/ })).toBeInTheDocument();
    expect(mocks.getBusinessView).toHaveBeenCalledWith({ template: "today" });
  });

  it("should_show_no_badge_when_nothing_needs_the_lister", async () => {
    mocks.getBusinessView.mockResolvedValue(today(0));
    render(<BusinessAssistantButton />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Assistant" })).toBeInTheDocument();
  });

  it("should_open_the_panel_and_stop_polling_while_it_is_open", async () => {
    mocks.getBusinessView.mockResolvedValue(today(2));
    render(<BusinessAssistantButton />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: /Assistant/ }));
    expect(screen.getByRole("dialog", { name: "Assistant panel" })).toBeInTheDocument();
    const calls = mocks.getBusinessView.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(BADGE_REFRESH_MS * 2);
    });
    expect(mocks.getBusinessView.mock.calls.length).toBe(calls);
    fireEvent.click(screen.getByRole("button", { name: "Close stub" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
