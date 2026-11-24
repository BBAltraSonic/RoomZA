import { isValidElement, Suspense, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ShowingRequest } from "./actions";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getLatestLandlordShowing: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("./actions", () => ({ getLatestLandlordShowing: mocks.getLatestLandlordShowing }));
vi.mock("./showing-request-banner-loader", () => ({ ShowingRequestBannerLoader: () => null }));

import { LandlordShowingInbox, LandlordShowingInboxContent } from "./landlord-showing-inbox";
import { ShowingRequestBannerLoader } from "./showing-request-banner-loader";

const request = { id: "showing-1", landlord_id: "landlord-1", status: "requested" } as ShowingRequest;

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.getLatestLandlordShowing.mockReset();
});

describe("LandlordShowingInbox", () => {
  it("should_stream_the_banner_so_it_never_blocks_the_page", () => {
    const element = LandlordShowingInbox() as ReactElement<{ children: ReactElement; fallback: unknown }>;
    expect(element.type).toBe(Suspense);
    expect(element.props.fallback).toBeNull();
    expect(element.props.children.type).toBe(LandlordShowingInboxContent);
  });

  it("should_seed_the_banner_with_the_latest_request_for_a_signed_in_landlord", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "landlord-1", is_anonymous: false } } });
    mocks.getLatestLandlordShowing.mockResolvedValue(request);

    const element = await LandlordShowingInboxContent();

    expect(isValidElement(element)).toBe(true);
    expect((element as ReactElement).type).toBe(ShowingRequestBannerLoader);
    expect((element as ReactElement).props).toEqual({ landlordId: "landlord-1", initialRequest: request });
  });

  it("should_still_listen_for_new_requests_when_none_is_pending", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "landlord-1", is_anonymous: false } } });
    mocks.getLatestLandlordShowing.mockResolvedValue(null);

    const element = (await LandlordShowingInboxContent()) as ReactElement;

    expect(element.props).toEqual({ landlordId: "landlord-1", initialRequest: null });
  });

  it("should_render_nothing_and_skip_the_inbox_read_when_signed_out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    expect(await LandlordShowingInboxContent()).toBeNull();
    expect(mocks.getLatestLandlordShowing).not.toHaveBeenCalled();
  });

  it("should_render_nothing_for_an_anonymous_session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "guest-1", is_anonymous: true } } });

    expect(await LandlordShowingInboxContent()).toBeNull();
    expect(mocks.getLatestLandlordShowing).not.toHaveBeenCalled();
  });
});
