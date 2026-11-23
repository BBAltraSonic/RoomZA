import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/showings/landlord-showing-inbox", () => ({ LandlordShowingInbox: () => null }));
vi.mock("@/features/organizations/organization-selector", () => ({ OrganizationSelector: () => null }));
vi.mock("@/features/organizations/data", () => ({
  getOrganizationContext: async () => ({ memberships: [], activeOrganization: null }),
}));
vi.mock("@/lib/auth", () => ({
  requireAnyPersona: async () => ({ user: { id: "landlord-1" }, profile: {}, personas: [] }),
}));

import { LandlordShowingInbox } from "@/features/showings/landlord-showing-inbox";
import { findElements } from "@/test/find-elements";

import DashboardLayout from "./layout";

describe("/dashboard layout", () => {
  it("should_mount_the_shared_landlord_showing_inbox_exactly_once", async () => {
    const tree = await DashboardLayout({ children: <p>Edit listing</p> });

    expect(findElements(tree, LandlordShowingInbox)).toHaveLength(1);
  });
});
