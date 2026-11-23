// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]'));
  const menuLabels = () => menuItems().map(item => item.textContent?.trim());
  const dockDestinations = ["/", "/saved", "/messages", "/profile/notifications", "/post"];

  it("holds only account items for members, in a fixed order", () => {
    render(<ProfileMenu compact isAuthenticated currentRole="renter" />);
    openMenu();
    expect(menuLabels()).toEqual(["Profile", "My listings", "Settings", "Help and safety", "Dark mode", "Sign out"]);
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("menuitem", { name: "My listings" })).toHaveAttribute("href", "/post/listings");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("menuitem", { name: "Help and safety" })).toHaveAttribute("href", "/trust");
  });

  it.each(["header", "dock"] as const)("never repeats a dock destination in the %s menu", placement => {
    render(<ProfileMenu placement={placement} isAuthenticated hasAdminAccess currentRole="landlord" />);
    openMenu();
    const hrefs = screen.getAllByRole("menuitem").map(item => item.getAttribute("href")).filter(Boolean);
    for (const href of dockDestinations) expect(hrefs).not.toContain(href);
    expect(menuItems().length).toBeLessThanOrEqual(7);
  });

  it("adds the admin console after Settings for admins", () => {
    render(<ProfileMenu isAuthenticated hasAdminAccess currentRole="landlord" />);
    openMenu();
    expect(menuLabels()).toEqual(["Profile", "My listings", "Settings", "Admin console", "Help and safety", "Dark mode", "Sign out"]);
  });

  it("gives guests only sign-in, help and theme", () => {
    render(<ProfileMenu />);
    openMenu();
    expect(menuLabels()).toEqual(["Sign in or create account", "Help and safety", "Dark mode"]);
  });

  it("opens the bottom-dock account menu upward with Profile", () => {
    render(<ProfileMenu placement="dock" isAuthenticated userName="Thandi Mokoena" currentRole="renter" />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(trigger).toHaveTextContent("TM");
    const menu = openMenu();
    expect(menu).toHaveAttribute("data-placement", "dock");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/profile");
  });
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
    render(<ProfileMenu isAuthenticated currentRole="renter" />);
    const trigger = screen.getByRole("button", { name: "Open menu" });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const menu = screen.getByRole("menu", { name: "Account menu" });
    const profile = screen.getByRole("menuitem", { name: "Profile" });
    const settings = screen.getByRole("menuitem", { name: "Settings" });
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });

    expect(profile).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "My listings" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(settings).toHaveFocus();

    fireEvent.keyDown(menu, { key: "End" });
    expect(signOut).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(profile).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(signOut).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Home" });
    expect(profile).toHaveFocus();
  });

  it("opens on Arrow Up, closes on Escape, and restores trigger focus", () => {
    render(<ProfileMenu isAuthenticated currentRole="renter" />);
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
        <ProfileMenu isAuthenticated currentRole="renter" />
        <button type="button">Outside control</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const profile = screen.getByRole("menuitem", { name: "Profile" });
    const outside = screen.getByRole("button", { name: "Outside control" });
    fireEvent.blur(profile, { relatedTarget: outside });
    outside.focus();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
  });

  it("keeps the current discovery query and Property ID in the sign-in return", () => {
    window.history.replaceState(null, "", "/?areaId=stored-place&listingId=home-id&view=feed&mode=buy&q=studio");
    render(<ProfileMenu />);
    openMenu();
    const href = screen.getByRole("menuitem", { name: "Sign in or create account" }).getAttribute("href")!;
    expect(new URL(href, "http://localhost").searchParams.get("redirect")).toBe("/?areaId=stored-place&listingId=home-id&view=feed&mode=buy&q=studio");
    window.history.replaceState(null, "", "/");
  });

  it("preserves guest, renter, landlord, authenticated, and admin entries", () => {
    const { rerender } = render(<ProfileMenu />);

    openMenu();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.getByText("Not signed in")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sign in or create account" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Settings" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
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
    expect(screen.getByRole("menuitem", { name: "My listings" })).toHaveAttribute("href", "/post/listings");
    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Help and safety" })).toBeInTheDocument();
  });

  it("closes after route and menu actions while preserving their outcomes", () => {
    render(<ProfileMenu />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Help and safety" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Dark mode" }));
    expect(window.localStorage.getItem("roomza-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
