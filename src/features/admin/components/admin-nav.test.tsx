// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { AdminNav } from "./admin-nav";

afterEach(cleanup);

describe("AdminNav", () => {
  it("opens the grouped mobile menu, closes with Escape, and restores focus", async () => {
    const user = userEvent.setup();
    render(<AdminNav isOwner={false} />);

    const more = screen.getByRole("button", { name: "More" });
    await user.click(more);
    const dialog = screen.getByRole("dialog", { name: "All admin sections" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('a[href="/admin"]')).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Admin members" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(dialog.querySelector('a[href="/admin/inbox"]')).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(dialog.querySelector('a[href="/admin"]')).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it("exposes owner-only destinations to owners", async () => {
    const user = userEvent.setup();
    render(<AdminNav isOwner />);
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getAllByRole("link", { name: "Admin members" }).length).toBeGreaterThan(0);
  });
});
