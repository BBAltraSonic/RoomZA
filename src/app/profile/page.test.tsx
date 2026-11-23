// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/features/profile/data", () => ({ getProfileDashboardData: vi.fn(async () => data.value) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/motion/primitives", async importOriginal => ({
  ...(await importOriginal<object>()),
  MotionReveal: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

import ProfilePage from "./page";

function profileData({ completion = 60, items = [] as { key: string; label: string; href: string }[], incomplete = false } = {}) {
  return {
    profile: { displayName: "Thandi Mokoena", username: "thandi", avatarUrl: null, personas: [{ persona: "renter", isActive: true, completion }] },
    attention: { items, incomplete },
    activity: [],
    verification: [],
  };
}

async function renderProfile(options?: Parameters<typeof profileData>[0]) {
  data.value = profileData(options);
  render(await ProfilePage());
}
afterEach(cleanup);

describe("profile overview", () => {
  it("leads with Complete profile while the profile is unfinished, and never Create listing", async () => {
    await renderProfile({ completion: 60 });
    expect(screen.getByRole("link", { name: /Complete profile/ })).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByRole("link", { name: "View public profile" })).toHaveAttribute("href", "/u/thandi");
    expect(screen.queryByRole("link", { name: "Create listing" })).not.toBeInTheDocument();
  });

  it("drops the primary button once the profile is complete", async () => {
    await renderProfile({ completion: 100 });
    expect(screen.queryByRole("link", { name: /Complete profile/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View public profile" })).toBeInTheDocument();
  });

  it("lists what needs attention instead of six count tiles", async () => {
    await renderProfile({ items: [{ key: "applicationsToReview", label: "2 applications to review", href: "/dashboard/applicants" }] });
    const section = screen.getByRole("region", { name: "Needs your attention" });
    expect(within(section).getByRole("link", { name: /2 applications to review/ })).toHaveAttribute("href", "/dashboard/applicants");
    for (const tile of ["Messages", "Notifications", "Saved", "Purchases"]) {
      expect(screen.queryByRole("link", { name: new RegExp(`^\\d*\\s*${tile}$`) })).not.toBeInTheDocument();
    }
  });

  it("says when everything is handled, and when some of it could not load", async () => {
    await renderProfile();
    expect(within(screen.getByRole("region", { name: "Needs your attention" })).getByText("You're all caught up.")).toBeInTheDocument();
    cleanup();
    await renderProfile({ incomplete: true });
    expect(within(screen.getByRole("region", { name: "Needs your attention" })).getByRole("status")).toHaveTextContent("Some items could not load");
  });
});
