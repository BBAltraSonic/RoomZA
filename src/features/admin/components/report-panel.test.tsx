// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { toast } from "sonner";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { submitModerationReport } = vi.hoisted(() => ({ submitModerationReport: vi.fn() }));

vi.mock("../actions", () => ({ submitModerationReport }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportPanel } from "./report-panel";

function pending<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
class ReportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert">Report form failed</p> : this.props.children; }
}
const reportText = "This synthetic message needs a safety review.";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

describe("ReportPanel message recovery", () => {
  async function fillReport() {
    const user = userEvent.setup();
    await user.click(screen.getByText("Report"));
    await user.type(screen.getByLabelText("Details"), reportText);
    return user;
  }
  it("protects the submitted reason and details while the request is pending", async () => {
    const request = pending<{ success: true; data: undefined }>(); submitModerationReport.mockReturnValue(request.promise);
    render(<ReportPanel messageId="message-a" />);
    const user = await fillReport(); await user.click(screen.getByRole("button", { name: "Submit report" }));
    try {
      expect(screen.getByLabelText("Reason")).toBeDisabled();
      expect(screen.getByLabelText("Details")).toBeDisabled();
    } finally { await act(async () => request.resolve({ success: true, data: undefined })); }
  });
  it("locks same-turn duplicate submissions", async () => {
    const request = pending<{ success: true; data: undefined }>(); submitModerationReport.mockReturnValue(request.promise);
    render(<ReportPanel messageId="message-a" />); await fillReport();
    const submit = screen.getByRole("button", { name: "Submit report" });
    act(() => { submit.click(); submit.click(); });
    try { expect(submitModerationReport).toHaveBeenCalledTimes(1); }
    finally { await act(async () => request.resolve({ success: true, data: undefined })); }
  });
  it("does not carry an old target's draft or late result into another message", async () => {
    const request = pending<{ success: true; data: undefined }>(); submitModerationReport.mockReturnValue(request.promise);
    const view = render(<ReportPanel messageId="message-a" />); await fillReport();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    view.rerender(<ReportPanel messageId="message-b" />);
    try {
      expect(screen.getByLabelText("Details")).toHaveValue("");
      fireEvent.change(screen.getByLabelText("Details"), { target: { value: "A different message needs its own review." } });
    } finally { await act(async () => request.resolve({ success: true, data: undefined })); }
    expect(screen.getByLabelText("Details")).toHaveValue("A different message needs its own review.");
    expect(toast.success).not.toHaveBeenCalled();
  });
  it("keeps the form and draft after a thrown request and offers a usable retry", async () => {
    submitModerationReport.mockRejectedValueOnce(new Error("Contained report transport loss"));
    render(<ReportBoundary><ReportPanel messageId="message-a" /></ReportBoundary>);
    const user = await fillReport(); await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be confirmed/i);
    expect(screen.getByLabelText("Details")).toHaveValue(reportText);
    expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
    submitModerationReport.mockResolvedValue({ success: true, data: undefined });
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(screen.getByLabelText("Details")).toHaveValue(""));
  });
  it("opens outside the clipping scroller and returns keyboard focus on Escape", async () => {
    const user = userEvent.setup();
    render(<div data-testid="message-scroller" style={{ overflow: "hidden" }}><ReportPanel messageId="message-a" label="Report message" popover compact /></div>);
    const trigger = screen.getByRole("button", { name: "Report message" });
    await user.click(trigger);
    const popup = await screen.findByRole("dialog", { name: "Report message" });
    expect(screen.getByTestId("message-scroller")).not.toContainElement(popup);
    await user.type(screen.getByRole("textbox", { name: "Details" }), reportText);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Report message" })).toBeNull());
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(await screen.findByRole("textbox", { name: "Details" })).toHaveValue(reportText);
  });
});

describe("ReportPanel Shopping Offer target", () => {
  it("provides a safe return-to-offer sign-in link after an anonymous rejection", async () => {
    const path = "/offers/55555555-5555-4555-8555-555555555555?from=report";
    window.history.replaceState(null, "", path);
    submitModerationReport.mockResolvedValue({ success: false, error: "Sign in to submit a report.", details: { code: "authentication_required" } });
    const user = userEvent.setup();
    render(<ReportPanel shoppingOfferId="55555555-5555-4555-8555-555555555555" label="Report this offer" />);
    await user.click(screen.getByText("Report this offer"));
    await user.type(screen.getByLabelText("Details"), "This synthetic offer needs a safety review.");
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("link", { name: "Sign in to submit this report" })).toHaveAttribute("href", `/auth?redirect=${encodeURIComponent(path)}`);
    expect(screen.getByLabelText("Details")).toHaveValue("This synthetic offer needs a safety review.");
  });
  it("submits the selected reason and details with the offer ID", async () => {
    submitModerationReport.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(<ReportPanel shoppingOfferId="55555555-5555-4555-8555-555555555555" label="Report this offer" />);

    await user.click(screen.getByText("Report this offer"));
    await user.selectOptions(screen.getByLabelText("Reason"), "safety");
    await user.type(screen.getByLabelText("Details"), "This synthetic offer needs a safety review.");
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => expect(submitModerationReport).toHaveBeenCalledWith({
      listingId: undefined,
      shoppingOfferId: "55555555-5555-4555-8555-555555555555",
      reportedUserId: undefined,
      messageId: undefined,
      listingImageId: undefined,
      category: "safety",
      details: "This synthetic offer needs a safety review.",
    }));
  });
});
