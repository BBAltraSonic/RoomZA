// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startCallMock = vi.fn();
const getActiveCallMock = vi.fn();
const toastInfoMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("./call-actions", () => ({
  startCall: (...args: unknown[]) => startCallMock(...args),
  getActiveCall: (...args: unknown[]) => getActiveCallMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfoMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import { CallButton } from "./call-button";

describe("CallButton call-state reconciliation", () => {
  beforeEach(() => {
    startCallMock.mockReset();
    getActiveCallMock.mockReset();
    toastInfoMock.mockReset();
    toastErrorMock.mockReset();
  });

  afterEach(cleanup);

  it("restores the authoritative active session instead of trying to join it again", async () => {
    const activeSession = {
      id: "session-active",
      conversation_id: "conversation-1",
      status: "active",
    };
    const onCallStarted = vi.fn();

    startCallMock.mockResolvedValue({
      success: false,
      error: "A call is already active in this conversation.",
    });
    getActiveCallMock.mockResolvedValue({
      success: true,
      data: { session: activeSession },
    });

    render(
      <CallButton
        conversationId="conversation-1"
        onCallStarted={onCallStarted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));

    await waitFor(() => {
      expect(onCallStarted).toHaveBeenCalledWith(activeSession);
    });
    expect(getActiveCallMock).toHaveBeenCalledWith("conversation-1");
    expect(toastInfoMock).toHaveBeenCalledWith("Active call restored.");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("does not start another call while shared state reports one in progress", () => {
    render(
      <CallButton
        conversationId="conversation-1"
        hasActiveCall
      />,
    );

    const button = screen.getByRole("button", { name: "Call in progress" });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(button);
    expect(startCallMock).not.toHaveBeenCalled();
  });
});
