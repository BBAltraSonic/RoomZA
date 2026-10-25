import { describe, expect, it } from "vitest";
import { isProtectedAccountPage } from "./protected-page";
describe("guest page gates", () => {
  it("includes the private workspace, appointment and invitation destinations", () => {
    for (const path of ["/purchases", "/viewings", "/viewings/id/live", "/post/entries/event/id", "/organization/invite", "/profile/edit", "/admin/reports/id"]) expect(isProtectedAccountPage(path)).toBe(true);
  });
  it("keeps discovery, auth, public profiles and similarly named public paths accessible", () => {
    for (const path of ["/", "/auth", "/auth/callback", "/listing/id", "/u/name", "/services", "/offers", "/viewings-public", "/profile-public", "/api/private/offers"]) expect(isProtectedAccountPage(path)).toBe(false);
  });
});
