/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/app/auth/auth-form";

vi.mock("@/app/auth/actions", () => ({
  signInAction: vi.fn(async () => ({})),
  signUpAction: vi.fn(async () => ({})),
}));

vi.mock("@/components/turnstile-widget", () => ({
  TurnstileWidget: () => null,
}));

afterEach(cleanup);

describe("AuthForm password controls", () => {
  it("shows and hides the sign-in password", async () => {
    const user = userEvent.setup();
    render(<AuthForm />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("generates and fills matching create-account passwords", async () => {
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.click(screen.getByRole("button", { name: "Use generated password" }));

    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const confirmation = screen.getByLabelText("Retype password") as HTMLInputElement;

    expect(password.value).toHaveLength(18);
    expect(confirmation.value).toBe(password.value);
    expect(screen.getByRole("status")).toHaveTextContent("Generated password filled in both fields.");
  });

  it("shows a mismatch error while retyping a different password", async () => {
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.type(screen.getByLabelText("Retype password"), "different123");

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(screen.getByLabelText("Retype password")).toHaveAttribute("aria-invalid", "true");
  });
});
