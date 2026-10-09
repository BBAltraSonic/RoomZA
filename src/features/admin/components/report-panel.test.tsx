// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { submitModerationReport } = vi.hoisted(() => ({ submitModerationReport: vi.fn() }));

vi.mock("../actions", () => ({ submitModerationReport }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportPanel } from "./report-panel";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
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
