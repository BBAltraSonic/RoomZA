/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/app/auth/auth-form";

const googleAction = vi.hoisted(() => vi.fn<(state: unknown, form: FormData) => Promise<{ message?: string }>>(async () => ({})));

vi.mock("@/app/auth/actions", () => ({
  signInAction: vi.fn(async () => ({})),
  signUpAction: vi.fn(async () => ({})),
  signInWithGoogleAction: googleAction,
}));

vi.mock("@/components/turnstile-widget", () => ({
  TurnstileWidget: () => null,
}));

afterEach(cleanup);
beforeEach(() => googleAction.mockReset().mockResolvedValue({}));

describe("Authentication control readiness", () => {
  it("disables client-only controls in server HTML while preserving Google submission", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<AuthForm />);
    const controls = within(host);
    expect(controls.getByRole("button", { name: "Show password" })).toBeDisabled();
    expect(controls.getByRole("button", { name: "Create account" })).toBeDisabled();
    expect(controls.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });

  it("enables client controls after hydration and handles the first password toggle", async () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<AuthForm />);
    document.body.appendChild(host);
    render(<AuthForm />, { container: host, hydrate: true });
    const controls = within(host);
    await waitFor(() => expect(controls.getByRole("button", { name: "Show password" })).toBeEnabled());
    await userEvent.setup().click(controls.getByRole("button", { name: "Show password" }));
    expect(controls.getByLabelText("Password")).toHaveAttribute("type", "text");
  });
});

describe("Google sign-in", () => {
  it("starts Google without email or password and preserves the return path", async () => {
    const user = userEvent.setup();
    render(<AuthForm redirectPath="/saved?view=homes" />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button).toBeEnabled();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    await user.click(button);
    await waitFor(() => expect(googleAction).toHaveBeenCalledOnce());
    const submitted = googleAction.mock.calls[0]![1];
    expect(submitted.get("redirect")).toBe("/saved?view=homes");
    expect(submitted.has("email")).toBe(false);
  });

  it("shows a retryable Google error", async () => {
    googleAction.mockResolvedValue({ message: "Google sign-in could not start. Please try again." });
    const user = userEvent.setup();
    render(<AuthForm />);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in could not start.");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});

describe("AuthForm signup and password controls", () => {
  it("creates an account without a consumer or lister role choice", async () => {
    const user = userEvent.setup(); render(<AuthForm />);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("Account role")).not.toBeInTheDocument();
    expect(new FormData(screen.getByLabelText("Password").closest("form")!).has("role")).toBe(false);
  });
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
