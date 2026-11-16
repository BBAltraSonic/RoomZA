// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(), confirmMoveIn: vi.fn(), requestDepositRefund: vi.fn(),
  contestDepositRefund: vi.fn(), cancelDepositAsOwner: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("./deposit-actions", () => ({
  confirmMoveIn: (id: string) => mocks.confirmMoveIn(id),
  requestDepositRefund: (id: string) => mocks.requestDepositRefund(id),
  contestDepositRefund: (id: string) => mocks.contestDepositRefund(id),
  cancelDepositAsOwner: (id: string) => mocks.cancelDepositAsOwner(id),
}));

import { DepositChoiceButtons, OwnerDepositActions } from "./deposit-buttons";

const paymentId = "10000000-0000-4000-8000-000000000020";
const choices = [
  { kind: "confirm_move_in", label: "I've moved in", confirm: "The landlord will be paid." },
  { kind: "request_refund", label: "I'm not satisfied", confirm: "The landlord has 24 hours to respond." },
] as const;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DepositChoiceButtons", () => {
  it("should ask before acting, then run the choice and refresh the page", async () => {
    mocks.confirmMoveIn.mockResolvedValue({ success: true, data: { state: "releasing" } });
    const user = userEvent.setup();
    render(<DepositChoiceButtons paymentId={paymentId} choices={[...choices]} />);

    await user.click(screen.getByRole("button", { name: "I've moved in" }));
    expect(mocks.confirmMoveIn).not.toHaveBeenCalled();
    expect(screen.getByText("The landlord will be paid.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Yes, I've moved in" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.confirmMoveIn).toHaveBeenCalledWith(paymentId);
  });

  it("should let the renter back out of a choice", async () => {
    const user = userEvent.setup();
    render(<DepositChoiceButtons paymentId={paymentId} choices={[...choices]} />);
    await user.click(screen.getByRole("button", { name: "I'm not satisfied" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByText("The landlord has 24 hours to respond.")).toBeNull();
    expect(mocks.requestDepositRefund).not.toHaveBeenCalled();
  });

  it("should show the reason when the action fails", async () => {
    mocks.requestDepositRefund.mockResolvedValue({ success: false, error: "This deposit can no longer be refunded." });
    const user = userEvent.setup();
    render(<DepositChoiceButtons paymentId={paymentId} choices={[...choices]} />);
    await user.click(screen.getByRole("button", { name: "I'm not satisfied" }));
    await user.click(screen.getByRole("button", { name: "Yes, I'm not satisfied" }));
    expect((await screen.findByRole("alert")).textContent).toContain("This deposit can no longer be refunded.");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("OwnerDepositActions", () => {
  it("should contest a refund request after the owner confirms", async () => {
    mocks.contestDepositRefund.mockResolvedValue({ success: true, data: { state: "disputed" } });
    const user = userEvent.setup();
    render(<OwnerDepositActions paymentId={paymentId} actions={["contest", "cancel"]} />);
    await user.click(screen.getByRole("button", { name: "They moved in" }));
    await user.click(screen.getByRole("button", { name: "Yes, they moved in" }));
    await waitFor(() => expect(mocks.contestDepositRefund).toHaveBeenCalledWith(paymentId));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("should cancel and refund in full after the owner confirms", async () => {
    mocks.cancelDepositAsOwner.mockResolvedValue({ success: true, data: { state: "refunding" } });
    const user = userEvent.setup();
    render(<OwnerDepositActions paymentId={paymentId} actions={["cancel"]} />);
    expect(screen.queryByRole("button", { name: "They moved in" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel the deposit" }));
    expect(screen.getByText(/full deposit/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Yes, cancel the deposit" }));
    await waitFor(() => expect(mocks.cancelDepositAsOwner).toHaveBeenCalledWith(paymentId));
  });

  it("should render nothing when there is nothing to do", () => {
    const { container } = render(<OwnerDepositActions paymentId={paymentId} actions={[]} />);
    expect(container.textContent).toBe("");
  });
});
