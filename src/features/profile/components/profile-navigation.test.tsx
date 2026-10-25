// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ProfileShell } from "./profile-shell";
import { SettingsShell } from "./settings-shell";

const route = vi.hoisted(() => ({ pathname: "/profile/documents" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);

describe("account section navigation", () => {
  it("keeps listing management and account settings reachable beside profile tasks", () => {
    render(<ProfileShell><p>Private documents</p></ProfileShell>);
    expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My listings" })).toHaveAttribute("href", "/post/listings");
    expect(screen.getByRole("link", { name: "Account settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByText("Private documents")).toBeVisible();
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
