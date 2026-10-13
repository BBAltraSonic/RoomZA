import { describe, expect, it } from "vitest";

import {
  adminNavigationGroups,
  isFocusedNavigationRoute,
  isNavigationItemActive,
  landlordNavigation,
  navigationAudience,
  navigationSurface,
  renterNavigation,
} from "./navigation-config";

describe("navigation configuration", () => {
  it("exposes one set of destinations for every ordinary account", () => {
    const expected = ["Explore", "Saved", "My listings", "Messages", "Profile"];
    expect(renterNavigation.map(item => item.label)).toEqual(expected);
    expect(landlordNavigation.map(item => item.label)).toEqual(expected);
  });
  it("derives account navigation independently of the legacy role", () => {
    expect(navigationAudience(false, null)).toBe("guest");
    for (const role of ["renter", "landlord", null] as const) expect(navigationAudience(true, role)).toBe("member");
  });
  it("keeps all category and property workspaces under My listings", () => {
    const explore = renterNavigation[0]!;
    const listings = renterNavigation[2]!;
    expect(isNavigationItemActive(explore, "/")).toBe(true);
    expect(isNavigationItemActive(explore, "/saved")).toBe(false);
    for (const path of ["/post/listings", "/dashboard", "/dashboard/buyers", "/post/services", "/post/entries/event", "/post/offers/id"])
      expect(isNavigationItemActive(listings, path)).toBe(true);
    for (const path of ["/saved", "/post", "/postcard", "/dashboard-other"])
      expect(isNavigationItemActive(listings, path)).toBe(false);
  });

  it("treats focused flows as navigation-free surfaces", () => {
    expect(isFocusedNavigationRoute("/auth/reset-password")).toBe(true);
    expect(isFocusedNavigationRoute("/messages/conversation-id")).toBe(true);
    expect(isFocusedNavigationRoute("/listing/listing-id")).toBe(true);
    expect(isFocusedNavigationRoute("/dashboard/listings/new")).toBe(true);
    expect(isFocusedNavigationRoute("/applications")).toBe(false);
  });

  it("keeps owner-only admin destinations identifiable and has four mobile core items", () => {
    const items = adminNavigationGroups.flatMap((group) => group.items);
    expect(items.filter((item) => item.placement === "admin-core").map((item) => item.label)).toEqual([
      "Overview",
      "Inbox",
      "Reports",
      "Operations",
    ]);
    expect(items.filter((item) => item.ownerOnly).map((item) => item.label)).toEqual(["Admin members"]);
  });
});

describe("global chrome ownership", () => {
  it.each([
    ["/", "discovery"], ["/offers/", "discovery"], ["/services", "discovery"],
    ["/admin", "admin"], ["/admin/security/mfa/setup", "admin"], ["/administrator", "workspace"],
    ["/auth", "focused"], ["/dashboard/listings/home/edit", "focused"], ["/messages/thread", "focused"],
    ["/profile/notifications", "workspace"], ["/settings/privacy", "workspace"], ["/post/offers", "workspace"],
    ["/offers/offer-id", "workspace"], ["/specials/special-id", "workspace"], ["/services/provider", "workspace"],
  ] as const)("classifies %s as %s", (route, surface) => {
    expect(navigationSurface(route)).toBe(surface);
  });
});
