// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MfaSetup } from "./mfa-flow";

const mocks = vi.hoisted(() => ({
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      mfa: {
        challengeAndVerify: mocks.challengeAndVerify,
        enroll: mocks.enroll,
      },
    },
  }),
}));

beforeEach(() => {
  mocks.challengeAndVerify.mockReset().mockResolvedValue({ error: null });
  mocks.enroll.mockReset()
    .mockResolvedValueOnce({
      data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml,factor-one", secret: "SECRET-ONE" } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { id: "factor-2", totp: { qr_code: "data:image/svg+xml,factor-two", secret: "SECRET-TWO" } },
      error: null,
    });
  mocks.refresh.mockReset();
  mocks.replace.mockReset();
});

afterEach(() => cleanup());

describe("MfaSetup", () => {
  it("starts a fresh enrollment when the verified factor count advances", async () => {
    const view = render(<MfaSetup requiredFactors={2} verifiedFactors={0} />);

    expect(await screen.findByText("SECRET-ONE")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Authenticator code" }), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    view.rerender(<MfaSetup requiredFactors={2} verifiedFactors={1} />);

    expect(await screen.findByText("SECRET-TWO")).toBeVisible();
    expect(screen.getByText("Enroll factor 2 of 2. Scan the code with an authenticator app, then enter its six-digit code.")).toBeVisible();
    expect(mocks.enroll).toHaveBeenNthCalledWith(2, { factorType: "totp", friendlyName: "Pinpoints admin factor 2" });

    fireEvent.change(screen.getByRole("textbox", { name: "Authenticator code" }), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(mocks.challengeAndVerify).toHaveBeenLastCalledWith({ factorId: "factor-2", code: "654321" });
      expect(mocks.replace).toHaveBeenCalledWith("/admin");
    });
  });

  it("keeps an invalid code retryable without forcing sign-out", async () => {
    mocks.challengeAndVerify.mockResolvedValueOnce({ error: { code: "mfa_verification_failed" } });
    render(<MfaSetup requiredFactors={2} verifiedFactors={1} />);

    expect(await screen.findByText("SECRET-ONE")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Authenticator code" }), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code did not match this authenticator");
    expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Authenticator code" })).toHaveValue("");
  });
});
