// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ProfileShell } from "./profile-shell";
import { SettingsShell } from "./settings-shell";

const route = vi.hoisted(() => ({ pathname: "/profile/documents" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);

describe("account section navigation", () => {
  it("lists only profile tasks; My listings and Settings live in the account menu", () => {
    render(<ProfileShell><p>Private documents</p></ProfileShell>);
    const nav = screen.getByRole("navigation", { name: "Profile sections" });
    expect(within(nav).getAllByRole("link").map(link => link.textContent?.trim()))
      .toEqual(["Overview", "Edit profile", "Verification", "Documents", "Reviews", "Activity"]);
    expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "My listings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByText("Private documents")).toBeVisible();
  });

  it("gives editing a profile one home: Settings no longer has a Profile section", () => {
    route.pathname = "/settings/privacy";
    render(<SettingsShell><p>Privacy controls</p></SettingsShell>);
    expect(screen.queryByRole("link", { name: /^Profile/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy & data/ })).toHaveAttribute("href", "/settings/privacy");
  });

  it("explains an empty settings search while keeping the selected section intact", () => {
    route.pathname = "/settings/security";
    render(<SettingsShell><p>Security controls</p></SettingsShell>);
    expect(screen.getByRole("link", { name: /Security/ })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), { target: { value: "no matching section" } });
    expect(screen.getByRole("status")).toHaveTextContent("No sections match");
    expect(screen.getByText("Security controls")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), { target: { value: "" } });
    expect(screen.getByRole("link", { name: /Security/ })).toHaveAttribute("aria-current", "page");
  });
});
