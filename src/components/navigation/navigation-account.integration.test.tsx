// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navigation } from "./navigation";
import { PinpointHeader } from "./pinpoint-header";

let pathname = "/profile/notifications";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode; prefetch?: boolean }) => { void prefetch; return <a href={href} {...props} onClick={event => { event.preventDefault(); props.onClick?.(event); }}>{children}</a>; },
}));
beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("account control in shared navigation", () => {
  it("preserves keyboard access, theme switching and a single trigger across route variants", async () => {
    const user = userEvent.setup();
    pathname = "/profile/notifications";
    const { rerender } = render(<Navigation isAuthenticated currentRole="renter"><main>Notifications</main></Navigation>);
    let trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const menu = screen.getByRole("menu", { name: "Account menu" });
    expect(within(menu).getByRole("menuitem", { name: "Profile" })).toHaveFocus();
    expect(within(menu).getByRole("menuitem", { name: "Applications" })).toHaveAttribute("href", "/applications");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("roomza-theme")).toBe("dark");

    pathname = "/";
    rerender(<Navigation isAuthenticated currentRole="renter"><PinpointHeader category="property" location={<button>Location</button>} /></Navigation>);
    expect(screen.getAllByRole("button", { name: "Open menu" })).toHaveLength(1);
    expect(document.querySelector('[data-slot="workspace-header"]')).toBeNull();
    expect(document.querySelectorAll('[data-slot="pinpoint-header"]')).toHaveLength(1);
    expect(document.body).toHaveAttribute("data-mobile-nav", "hidden");
    trigger = screen.getByRole("button", { name: "Open menu" });
    await user.click(trigger);
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Applications" })).toBeInTheDocument();
  });

  it("clears signed-in destinations when account state changes and preserves guest return URLs", async () => {
    const user = userEvent.setup();
    pathname = "/profile/notifications";
    const { rerender } = render(<Navigation isAuthenticated currentRole="landlord" hasAdminAccess><main>Content</main></Navigation>);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("menuitem", { name: "Admin console" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    window.history.replaceState({}, "", "/blog?topic=homes");
    pathname = "/blog";
    rerender(<Navigation><main>Blog</main></Navigation>);
    expect(screen.queryByRole("link", { name: "Add listing" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByRole("menuitem", { name: "Admin console" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).not.toBeInTheDocument();
    const signIn = new URL(screen.getByRole("menuitem", { name: "Sign in or create account" }).getAttribute("href")!, "http://localhost");
    expect(signIn.searchParams.get("redirect")).toBe("/blog?topic=homes");
  });
});
