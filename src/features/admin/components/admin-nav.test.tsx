// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminNav } from "./admin-nav";
import { NavigationContext } from "@/components/navigation/navigation-account-context";
import { ProfileMenu } from "@/components/navigation/profile-menu";
import { adminNavigationGroups } from "@/components/navigation/navigation-config";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users" }));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode; prefetch?: boolean }) => { void prefetch; return <a href={href} {...props} onClick={event => { event.preventDefault(); props.onClick?.(event); }}>{children}</a>; } }));
afterEach(cleanup);

function renderAdmin(isOwner: boolean) {
  return render(<NavigationContext.Provider value={{ audience: "renter", isAuthenticated: true, profileMenu: <ProfileMenu compact isAuthenticated hasAdminAccess userName="Admin Person" /> }}><AdminNav isOwner={isOwner} /></NavigationContext.Provider>);
}

describe("AdminNav", () => {
  it("replaces the mobile bottom bar with a profile menu containing every permitted admin section", async () => {
    const user = userEvent.setup();
    renderAdmin(false);
    expect(screen.queryByRole("navigation", { name: "Admin primary navigation" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="admin-mobile-header"]')).toHaveClass("md:hidden");
    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const menu = screen.getByRole("menu", { name: "Account menu" });
    expect(within(menu).getByRole("menuitem", { name: "Admin console" })).toHaveFocus();
    for (const group of adminNavigationGroups) {
      const section = within(menu).getByRole("group", { name: group.label });
      for (const item of group.items.filter(item => !item.ownerOnly)) {
        expect(within(section).getByRole("menuitem", { name: item.label })).toHaveAttribute("href", item.href);
      }
    }
    expect(within(menu).queryByRole("menuitem", { name: "Admin members" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Explore" })).toHaveAttribute("href", "/");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Users" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("preserves owner-only destinations", () => {
    renderAdmin(true);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Admin members" })).toHaveAttribute("href", "/admin/settings/admins");
  });
});
