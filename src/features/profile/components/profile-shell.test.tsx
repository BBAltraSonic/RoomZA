// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileShell } from "./profile-shell";

const pathname = vi.hoisted(() => ({ current: "/profile" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

afterEach(cleanup);

describe("ProfileShell", () => {
  it("should_show_profile_section_tabs_on_profile_pages", () => {
    pathname.current = "/profile/edit";
    render(<ProfileShell><p>content</p></ProfileShell>);
    expect(screen.getByRole("navigation", { name: "Profile sections" })).toBeTruthy();
  });

  it("should_hide_the_profile_header_on_the_notifications_page", () => {
    pathname.current = "/profile/notifications";
    render(<ProfileShell><p>content</p></ProfileShell>);
    expect(screen.queryByRole("navigation", { name: "Profile sections" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Pinpoint" })).toBeNull();
    expect(screen.getByText("content")).toBeTruthy();
  });
});
