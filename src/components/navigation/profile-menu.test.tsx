// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

import { ProfileMenu } from "./profile-menu";

beforeEach(() => {
  toastMock.mockReset();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return screen.getByRole("menu", { name: "Account menu" });
}

describe("ProfileMenu", () => {
  it("opens as a visible CSS disclosure with stable synchronized attributes", () => {
    render(<ProfileMenu />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const menu = openMenu();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAccessibleName("Close menu");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(menu.id).toMatch(/^profile-menu-/);
    expect(menu).toHaveClass("profile-menu-surface");
    expect(menu).toHaveClass("overflow-y-auto");
    expect(menu.style.opacity).toBe("");

    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAccessibleName("Open menu");
  });

  it("closes for pointer and touch interactions outside the disclosure", () => {
    render(<ProfileMenu />);

    openMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    openMenu();
    fireEvent.touchStart(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("uses native Enter and Space button activation", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu />);
    const trigger = screen.getByRole("button", { name: "Open menu" });

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu", { name: "Account menu" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();

    await user.keyboard(" ");
    expect(screen.getByRole("menu", { name: "Account menu" })).toBeInTheDocument();
  });

  it("opens from the trigger arrows and supports wrapped menu navigation", () => {
    render(<ProfileMenu />);
    const trigger = screen.getByRole("button", { name: "Open menu" });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const menu = screen.getByRole("menu", { name: "Account menu" });
    const saved = screen.getByRole("menuitem", { name: "Saved" });
    const messages = screen.getByRole("menuitem", { name: "Messages" });
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });

    expect(saved).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(messages).toHaveFocus();

    fireEvent.keyDown(menu, { key: "End" });
    expect(signOut).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(saved).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(signOut).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Home" });
    expect(saved).toHaveFocus();
  });

  it("opens on Arrow Up, closes on Escape, and restores trigger focus", () => {
    render(<ProfileMenu />);
    const trigger = screen.getByRole("button", { name: "Open menu" });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowUp" });

    const menu = screen.getByRole("menu", { name: "Account menu" });
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes without stealing focus when focus leaves the menu", () => {
    render(
      <>
        <ProfileMenu />
        <button type="button">Outside control</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const saved = screen.getByRole("menuitem", { name: "Saved" });
    const outside = screen.getByRole("button", { name: "Outside control" });
    fireEvent.blur(saved, { relatedTarget: outside });
    outside.focus();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
  });

  it("preserves guest, renter, landlord, authenticated, and admin entries", () => {
    const { rerender } = render(<ProfileMenu />);

    openMenu();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.getByText("Not signed in")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Privacy and settings" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));

    rerender(
      <ProfileMenu
        isAuthenticated
        userName="Rene Renter"
        userEmail="rene@example.com"
        currentRole="renter"
      />,
    );
    openMenu();
    expect(screen.getByText("Rene Renter")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Privacy and settings" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));

    rerender(
      <ProfileMenu
        isAuthenticated
        userName="Lana Landlord"
        userEmail="lana@example.com"
        currentRole="landlord"
        hasAdminAccess
      />,
    );
    openMenu();
    expect(screen.getByText("Lana Landlord")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Admin console" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Listings" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "New Listing" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Applicants" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Viewings" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Saved" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Trust and safety" }),
    ).toBeInTheDocument();
  });

  it("closes after route and menu actions while preserving their outcomes", () => {
    render(<ProfileMenu />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Saved" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Notifications" }));
    expect(toastMock).toHaveBeenCalledWith("No new notifications");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Dark mode" }));
    expect(window.localStorage.getItem("roomza-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
