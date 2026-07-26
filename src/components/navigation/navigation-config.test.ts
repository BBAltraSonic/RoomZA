import { describe, expect, it } from "vitest";

import {
  adminNavigationGroups,
  isFocusedNavigationRoute,
  isNavigationItemActive,
  landlordNavigation,
  navigationAudience,
  renterNavigation,
} from "./navigation-config";

describe("navigation configuration", () => {
  it("exposes the agreed renter and landlord destinations in order", () => {
    expect(renterNavigation.map((item) => item.label)).toEqual([
      "Explore",
      "Saved",
      "Applications",
      "Messages",
      "Profile",
    ]);
    expect(landlordNavigation.map((item) => item.label)).toEqual([
      "Explore",
      "Listings",
      "Applicants",
      "Viewings",
      "Messages",
    ]);
  });

  it("derives audiences without treating an unknown authenticated role as a landlord", () => {
    expect(navigationAudience(false, null)).toBe("guest");
    expect(navigationAudience(true, "renter")).toBe("renter");
    expect(navigationAudience(true, "landlord")).toBe("landlord");
    expect(navigationAudience(true, null)).toBe("renter");
  });

  it("uses exact root matching and keeps listing subroutes under Listings", () => {
    const explore = renterNavigation[0]!;
    const listings = landlordNavigation[1]!;
    const applicants = landlordNavigation[2]!;
    expect(isNavigationItemActive(explore, "/")).toBe(true);
    expect(isNavigationItemActive(explore, "/saved")).toBe(false);
    expect(isNavigationItemActive(listings, "/dashboard")).toBe(true);
    expect(isNavigationItemActive(listings, "/dashboard/listings/new")).toBe(true);
    expect(isNavigationItemActive(listings, "/dashboard/applicants")).toBe(false);
    expect(isNavigationItemActive(applicants, "/dashboard/applicants")).toBe(true);
    expect(isNavigationItemActive(applicants, "/dashboard/buyers")).toBe(true);
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
