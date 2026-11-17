// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveDepositDispute: vi.fn(),
  revealOwnerPayoutAccount: vi.fn(),
  recordOwnerPayout: vi.fn(),
  takeDepositRefund: vi.fn(),
  recordManualRefund: vi.fn(),
  markPaymentEventReviewed: vi.fn(),
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("./admin-actions", () => ({
  resolveDepositDispute: (input: unknown) => mocks.resolveDepositDispute(input),
  revealOwnerPayoutAccount: (id: string) => mocks.revealOwnerPayoutAccount(id),
  recordOwnerPayout: (input: unknown) => mocks.recordOwnerPayout(input),
  takeDepositRefund: (id: string) => mocks.takeDepositRefund(id),
  recordManualRefund: (input: unknown) => mocks.recordManualRefund(input),
  markPaymentEventReviewed: (input: unknown) => mocks.markPaymentEventReviewed(input),
}));

import { AdminDepositControls, ProviderEventReview } from "./admin-deposit-controls";
import { formatCents } from "./deposit-view";

const paymentId = "10000000-0000-4000-8000-000000000020";
const amounts = { amountCents: 800_000, ownerPayoutCents: 720_000, renterRefundCents: 800_000, providerFeeCents: 26_795 };
const none = { dispute: false, payout: false, takeRefund: false, recordRefund: false };

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of [mocks.resolveDepositDispute, mocks.recordOwnerPayout, mocks.takeDepositRefund, mocks.recordManualRefund, mocks.markPaymentEventReviewed]) {
    action.mockResolvedValue({ success: true, data: { state: "x" } });
  }
});
afterEach(cleanup);

describe("AdminDepositControls", () => {
  it("should render nothing when no decision is open", () => {
    const { container } = render(<AdminDepositControls paymentId={paymentId} panels={none} amounts={amounts} ownerHasBankDetails />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should decide a dispute only with a choice and a reason, and offer to waive the fee on a refund", async () => {
    const user = userEvent.setup();
    render(<AdminDepositControls paymentId={paymentId} panels={{ ...none, dispute: true }} amounts={amounts} ownerHasBankDetails />);
    const confirm = screen.getByRole("button", { name: "Confirm decision" });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /refund them/ }));
    expect(screen.getByText(/renter gets/).textContent).toContain(`${formatCents(773_205)} back`);
    await user.click(screen.getByRole("checkbox", { name: /Waive the/ }));
    expect(screen.getByText(/renter gets/).textContent).toContain(`${formatCents(800_000)} back`);
    await user.type(screen.getByRole("textbox"), "Photos show the unit did not match");
    await user.click(confirm);

    await waitFor(() => expect(mocks.resolveDepositDispute).toHaveBeenCalledWith({
      paymentId, resolution: "refund", waiveCancellationFee: true, reason: "Photos show the unit did not match",
    }));
  });

  it("should show the bank details only when asked, warn when they changed after payment, and record the transfer", async () => {
    const user = userEvent.setup();
    mocks.revealOwnerPayoutAccount.mockResolvedValue({
      success: true,
      data: {
        accountHolder: "Plan Owner", bankName: "Test Bank", branchCode: "250655", accountNumber: "62000000001",
        updatedAt: "2026-12-01T10:00:00Z", changedAfterPayment: true, payoutCents: 720_000,
      },
    });
    render(<AdminDepositControls paymentId={paymentId} panels={{ ...none, payout: true }} amounts={amounts} ownerHasBankDetails />);
    expect(screen.queryByText("62000000001")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show bank details" }));
    expect(await screen.findByText("62000000001")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/changed .* after the renter paid/);

    const record = screen.getByRole("button", { name: "Record payout sent" });
    expect(record).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /Bank reference/ }), "EFT-1");
    await user.click(record);
    await waitFor(() => expect(mocks.recordOwnerPayout).toHaveBeenCalledWith({ paymentId, bankReference: "EFT-1" }));
  });

  it("should say the owner has no bank details instead of offering to show them", () => {
    render(<AdminDepositControls paymentId={paymentId} panels={{ ...none, payout: true }} amounts={amounts} ownerHasBankDetails={false} />);
    expect(screen.queryByRole("button", { name: "Show bank details" })).not.toBeInTheDocument();
    expect(screen.getByText(/no bank details saved/)).toBeInTheDocument();
  });

  it("should take a refund off the automatic path, and record one made by hand", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AdminDepositControls paymentId={paymentId} panels={{ ...none, takeRefund: true }} amounts={amounts} ownerHasBankDetails />);
    await user.click(screen.getByRole("button", { name: "Refund it by hand" }));
    await waitFor(() => expect(mocks.takeDepositRefund).toHaveBeenCalledWith(paymentId));

    rerender(<AdminDepositControls paymentId={paymentId} panels={{ ...none, recordRefund: true }} amounts={amounts} ownerHasBankDetails />);
    await user.type(screen.getByRole("textbox", { name: /Bank reference of the refund/ }), "EFT-9");
    await user.click(screen.getByRole("button", { name: "Record refund sent" }));
    await waitFor(() => expect(mocks.recordManualRefund).toHaveBeenCalledWith({ paymentId, reference: "EFT-9" }));
  });
});

describe("ProviderEventReview", () => {
  it("should settle a charge only with a note of what was done", async () => {
    const user = userEvent.setup();
    const eventId = "10000000-0000-4000-8000-000000000030";
    render(<ProviderEventReview eventId={eventId} />);
    const settle = screen.getByRole("button", { name: "Mark settled" });
    expect(settle).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "What was done about this payment" }), "Refunded on Paystack");
    await user.click(settle);
    await waitFor(() => expect(mocks.markPaymentEventReviewed).toHaveBeenCalledWith({ eventId, note: "Refunded on Paystack" }));
  });
});
