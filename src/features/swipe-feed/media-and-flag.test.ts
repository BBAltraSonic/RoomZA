import { describe, expect, it } from "vitest";

import { isSwipeFeedEnabled, parseSwipeFeedMode } from "./feature-flag";
import { readSwipeFeedMode } from "./feature-flag.server";
import { mediaKind } from "./media-kind";

describe("mediaKind", () => {
  it("should_be_photos_when_a_listing_has_a_usable_image", () => {
    expect(mediaKind({ images: [{ public_url: "https://cdn.test/a.jpg" }] })).toBe("photos");
  });

  it("should_be_none_without_images_or_with_only_empty_urls", () => {
    expect(mediaKind({ images: [] })).toBe("none");
    expect(mediaKind({ images: null })).toBe("none");
    expect(mediaKind({})).toBe("none");
    expect(mediaKind({ images: [{ public_url: "" }, { public_url: "   " }] })).toBe("none");
  });
});

describe("parseSwipeFeedMode", () => {
  it("should_accept_the_three_modes_in_any_case_and_spacing", () => {
    expect(parseSwipeFeedMode("on")).toBe("on");
    expect(parseSwipeFeedMode(" Preview ")).toBe("preview");
    expect(parseSwipeFeedMode("OFF")).toBe("off");
  });

  it("should_default_to_off_for_missing_or_unknown_values", () => {
    expect(parseSwipeFeedMode(undefined)).toBe("off");
    expect(parseSwipeFeedMode("")).toBe("off");
    expect(parseSwipeFeedMode("true")).toBe("off");
  });
});

describe("isSwipeFeedEnabled", () => {
  it("should_be_on_for_everyone_when_the_mode_is_on", () => {
    expect(isSwipeFeedEnabled("on", new URLSearchParams())).toBe(true);
  });

  it("should_need_the_preview_param_in_preview_mode", () => {
    expect(isSwipeFeedEnabled("preview", new URLSearchParams())).toBe(false);
    expect(isSwipeFeedEnabled("preview", new URLSearchParams("feed=1"))).toBe(true);
    expect(isSwipeFeedEnabled("preview", new URLSearchParams("feed=yes"))).toBe(false);
  });

  it("should_stay_off_even_with_the_preview_param_when_off", () => {
    expect(isSwipeFeedEnabled("off", new URLSearchParams("feed=1"))).toBe(false);
  });
});

describe("readSwipeFeedMode", () => {
  it("should_read_the_server_environment", () => {
    expect(readSwipeFeedMode({ SWIPE_FEED: "preview" })).toBe("preview");
    expect(readSwipeFeedMode({})).toBe("off");
  });
});
