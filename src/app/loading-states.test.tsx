import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AppLoading from "./loading";
import AdminLoading from "./admin/loading";
import OfferReviewLoading from "./admin/offers/loading";
import ConfirmedLoading from "./admin/offers/confirmed/loading";
import ServiceReviewLoading from "./admin/services/loading";
import VerifyEmailLoading from "./auth/verify-email/loading";
import DashboardLoading from "./dashboard/loading";
import ListingApplicantsLoading from "./dashboard/listings/[id]/applicants/loading";
import ListingLoading from "./listing/[id]/loading";
import MessagesLoading from "./messages/loading";
import ConversationLoading from "./messages/[id]/loading";
import OffersLoading from "./offers/loading";
import OfferLoading from "./offers/[id]/loading";
import EntryWorkspaceLoading from "./post/entries/loading";
import OfferWorkspaceLoading from "./post/offers/loading";
import ServicesWorkspaceLoading from "./post/services/loading";
import ProfileLoading from "./profile/loading";
import SettingsLoading from "./settings/loading";

const loaders: [route: string, Loader: ComponentType, label: string][] = [
  ["/", AppLoading, "Loading page"],
  ["/admin", AdminLoading, "Loading admin workspace"],
  ["/admin/offers", OfferReviewLoading, "Loading submitted offers"],
  ["/admin/offers/confirmed", ConfirmedLoading, "Loading confirmed offers"],
  ["/admin/services", ServiceReviewLoading, "Loading service submissions"],
  ["/auth/verify-email", VerifyEmailLoading, "Loading email verification"],
  ["/dashboard", DashboardLoading, "Loading your dashboard"],
  ["/dashboard/listings/[id]/applicants", ListingApplicantsLoading, "Loading applicants"],
  ["/messages", MessagesLoading, "Loading conversations"],
  ["/messages/[id]", ConversationLoading, "Loading conversation"],
  ["/offers", OffersLoading, "Loading Shopping Offer"],
  ["/offers/[id]", OfferLoading, "Loading Shopping Offer"],
  ["/post/entries", EntryWorkspaceLoading, "Loading your entries"],
  ["/post/offers", OfferWorkspaceLoading, "Loading your offers"],
  ["/post/services", ServicesWorkspaceLoading, "Loading your services"],
  ["/profile", ProfileLoading, "Loading profile"],
  ["/settings", SettingsLoading, "Loading settings"],
];

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
