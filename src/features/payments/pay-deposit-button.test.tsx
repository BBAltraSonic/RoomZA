// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ start: vi.fn(), send: vi.fn() }));
vi.mock("./actions", () => ({ startDepositCheckout: (id: string) => mocks.start(id) }));
vi.mock("./checkout-redirect", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./checkout-redirect")>()),
  sendBrowserToCheckout: (url: string) => mocks.send(url),
}));

import { isPaystackCheckoutUrl } from "./checkout-redirect";
import { PayDepositButton } from "./pay-deposit-button";

const applicationId = "10000000-0000-4000-8000-000000000010";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PayDepositButton", () => {
  it("should open the Paystack checkout the server returns", async () => {
    mocks.start.mockResolvedValue({ success: true, data: { checkoutUrl: "https://checkout.paystack.com/abc" } });
    render(<PayDepositButton applicationId={applicationId}>Pay deposit</PayDepositButton>);

    await userEvent.setup().click(screen.getByRole("button", { name: "Pay deposit" }));

    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("https://checkout.paystack.com/abc"));
    expect(mocks.start).toHaveBeenCalledWith(applicationId);
  });

  it("should show why the checkout could not open and let the renter try again", async () => {
    mocks.start.mockResolvedValue({ success: false, error: "Your deposit is already paid." });
    render(<PayDepositButton applicationId={applicationId}>Pay deposit</PayDepositButton>);

    await userEvent.setup().click(screen.getByRole("button", { name: "Pay deposit" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Your deposit is already paid.");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Pay deposit" }).disabled).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("should refuse to send the browser anywhere but Paystack's checkout", async () => {
    mocks.start.mockResolvedValue({ success: true, data: { checkoutUrl: "https://evil.example/pay" } });
    render(<PayDepositButton applicationId={applicationId}>Pay deposit</PayDepositButton>);

    await userEvent.setup().click(screen.getByRole("button", { name: "Pay deposit" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("should recover when the server action throws", async () => {
    mocks.start.mockRejectedValue(new Error("network"));
    render(<PayDepositButton applicationId={applicationId}>Pay deposit</PayDepositButton>);

    await userEvent.setup().click(screen.getByRole("button", { name: "Pay deposit" }));

    expect((await screen.findByRole("alert")).textContent).toContain("We could not open the payment page");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Pay deposit" }).disabled).toBe(false);
  });
});

describe("isPaystackCheckoutUrl", () => {
  it("should accept only https links on Paystack's checkout host", () => {
    expect(isPaystackCheckoutUrl("https://checkout.paystack.com/0peioxfhpn")).toBe(true);
    expect(isPaystackCheckoutUrl("http://checkout.paystack.com/0peioxfhpn")).toBe(false);
    expect(isPaystackCheckoutUrl("https://checkout.paystack.com.evil.example/x")).toBe(false);
    expect(isPaystackCheckoutUrl("javascript:alert(1)")).toBe(false);
    expect(isPaystackCheckoutUrl("not a url")).toBe(false);
  });
});
