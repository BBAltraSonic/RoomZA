import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/showings/landlord-showing-inbox", () => ({ LandlordShowingInbox: () => null }));

import { LandlordShowingInbox } from "@/features/showings/landlord-showing-inbox";
import { findElements } from "@/test/find-elements";

import PostLayout from "./layout";

describe("/post layout", () => {
  it("should_mount_the_landlord_showing_inbox_once_above_every_post_page", () => {
    const page = <p>My listings</p>;
    const tree = PostLayout({ children: page });

    expect(findElements(tree, LandlordShowingInbox)).toHaveLength(1);
    expect(findElements(tree, "p")).toEqual([page]);
  });

  it("should_not_add_a_main_landmark_because_nested_workspaces_render_their_own", () => {
    expect(findElements(PostLayout({ children: null }), "main")).toHaveLength(0);
  });
});
