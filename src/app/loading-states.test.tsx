import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AppLoading from "./loading";
import AdminLoading from "./admin/loading";
import VerifyEmailLoading from "./auth/verify-email/loading";
import ListingApplicantsLoading from "./dashboard/listings/[id]/applicants/loading";
import ListingLoading from "./listing/[id]/loading";
import MessagesLoading from "./messages/(inbox)/loading";
import ConversationLoading from "./messages/[id]/loading";
import OfferLoading from "./offers/[id]/loading";
import EntryWorkspaceLoading from "./post/entries/loading";
import OfferWorkspaceLoading from "./post/offers/loading";
import ProfileLoading from "./profile/loading";
import SettingsLoading from "./settings/loading";

const APP_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const loaders: [route: string, Loader: ComponentType, label: string][] = [
  ["/admin", AdminLoading, "Loading admin workspace"],
  ["/auth/verify-email", VerifyEmailLoading, "Loading email verification"],
  ["/dashboard/listings/[id]/applicants", ListingApplicantsLoading, "Loading applicants"],
  ["/messages", MessagesLoading, "Loading conversations"],
  ["/messages/[id]", ConversationLoading, "Loading conversation"],
  ["/offers/[id]", OfferLoading, "Loading Shopping Offer"],
  ["/post/entries", EntryWorkspaceLoading, "Loading your entries"],
  ["/post/offers", OfferWorkspaceLoading, "Loading your offers"],
  ["/profile", ProfileLoading, "Loading profile"],
  ["/settings", SettingsLoading, "Loading settings"],
];

/** Every loading.tsx under src/app, as a path relative to it ("" is the root loader's folder). */
function findLoaderDirs(dir = APP_DIR): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return findLoaderDirs(full);
    return name === "loading.tsx" ? [path.relative(APP_DIR, dir).split(path.sep).join("/")] : [];
  });
}

describe("route loading states", () => {
  it.each(loaders)("should_show_a_labelled_shimmer_skeleton_for_%s", (_route, Loader, label) => {
    const html = renderToStaticMarkup(<Loader />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`<span class="sr-only">${label}</span>`);
    expect(html.split('data-slot="skeleton"').length - 1).toBeGreaterThanOrEqual(4);
  });

  it.each(loaders)("should_not_fall_back_to_plain_loading_text_for_%s", (_route, Loader) => {
    const html = renderToStaticMarkup(<Loader />);

    expect(html).not.toMatch(/<p role="status"[^>]*>Loading/);
    expect(html).not.toContain("animate-pulse");
  });

  it("should_hand_listing_detail_to_the_discovery_fallback_so_the_map_layout_appears_at_once", () => {
    const html = renderToStaticMarkup(<ListingLoading />);

    expect(html).toContain("Homes in view");
  });
});

describe("one skeleton per navigation", () => {
  it("should_keep_the_root_loader_free_of_skeleton_blocks_so_it_never_flashes_a_shape_the_destination_does_not_have", () => {
    // The root loader shows before every section whose layout awaits auth, and
    // before the map. A card grid there was the first of two skeletons.
    const html = renderToStaticMarkup(<AppLoading />);

    expect(html).toContain('role="status"');
    expect(html).toContain('<span class="sr-only">Loading page</span>');
    expect(html).not.toContain('data-slot="skeleton"');
    expect(html).not.toContain("animate-pulse");
  });

  it("should_not_nest_a_route_loader_inside_another_so_one_navigation_shows_one_skeleton", () => {
    // A loading.tsx wraps every route below its folder, so a second one deeper
    // in the same branch makes Next show the parent's skeleton, then the child's.
    // Put a parent's own loader in a route group, e.g. messages/(inbox)/loading.tsx.
    const dirs = findLoaderDirs().filter((dir) => dir !== "");
    const nested = dirs.flatMap((dir) =>
      dirs.filter((other) => other !== dir && dir.startsWith(`${other}/`)).map((parent) => `${dir} sits under ${parent}`),
    );

    expect(nested).toEqual([]);
  });
});
