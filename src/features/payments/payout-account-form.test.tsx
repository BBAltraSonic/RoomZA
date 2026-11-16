// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("./actions", () => ({ saveOwnerPayoutAccount: (input: unknown) => mocks.save(input) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { PayoutAccountForm } from "./payout-account-form";

const saved = {
  accountHolder: "Thandi Owner", bankName: "FNB", branchCode: "250655", accountLast4: "0001",
  updatedAt: "2026-11-16T08:00:00+00:00",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Account holder"), "Thandi Owner");
  await user.type(screen.getByLabelText("Bank"), "FNB");
  await user.type(screen.getByLabelText("Branch code"), "250655");
  await user.type(screen.getByLabelText("Account number"), "62000000001");
}

describe("PayoutAccountForm", () => {
  it("should save new bank details and then show only the last four digits", async () => {
    mocks.save.mockResolvedValue({ success: true, data: saved });
    const user = userEvent.setup();
    render(<PayoutAccountForm initial={null} />);

    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Save bank details" }));

    expect(mocks.save).toHaveBeenCalledWith({
      accountHolder: "Thandi Owner", bankName: "FNB", branchCode: "250655", accountNumber: "62000000001",
    });
    expect(await screen.findByText("FNB · account ending 0001")).toBeTruthy();
    expect(document.body.textContent).not.toContain("62000000001");
    expect(screen.queryByLabelText("Account number")).toBeNull();
  });

  it("should mark each field the server rejected", async () => {
    mocks.save.mockResolvedValue({
      success: false, error: "Fix the highlighted fields.",
      details: { fieldErrors: { branchCode: ["A branch code is six digits."] } },
    });
    const user = userEvent.setup();
    render(<PayoutAccountForm initial={null} />);

    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Save bank details" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Fix the highlighted fields.");
    const branch = screen.getByLabelText("Branch code");
    expect(branch.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(branch.getAttribute("aria-describedby") ?? "")?.textContent).toBe("A branch code is six digits.");
  });

  it("should show saved details and ask for the whole account again to replace them", async () => {
    const user = userEvent.setup();
    render(<PayoutAccountForm initial={saved} />);

    expect(screen.getByText("FNB · account ending 0001")).toBeTruthy();
    expect(screen.queryByLabelText("Account number")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Replace bank details" }));
    expect(screen.getByLabelText<HTMLInputElement>("Account number").value).toBe("");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Account number")).toBeNull();
  });
});
