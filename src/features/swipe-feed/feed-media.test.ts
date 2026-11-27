import { describe, expect, it } from "vitest";

import { staticMapUrl, stepPhoto } from "./feed-media";

describe("stepPhoto", () => {
  it("should_go_to_the_next_photo_when_the_right_third_is_tapped", () => {
    expect(stepPhoto({ index: 0, count: 3, xRatio: 0.9 })).toBe(1);
  });

  it("should_go_back_when_the_left_third_is_tapped", () => {
    expect(stepPhoto({ index: 2, count: 3, xRatio: 0.1 })).toBe(1);
  });

  it("should_stay_put_on_a_middle_tap", () => {
    expect(stepPhoto({ index: 1, count: 3, xRatio: 0.5 })).toBe(1);
  });

  it("should_stop_at_the_first_and_last_photo", () => {
    expect(stepPhoto({ index: 0, count: 3, xRatio: 0.1 })).toBe(0);
    expect(stepPhoto({ index: 2, count: 3, xRatio: 0.9 })).toBe(2);
  });

  it("should_stay_at_zero_without_photos", () => {
    expect(stepPhoto({ index: 0, count: 0, xRatio: 0.9 })).toBe(0);
  });
});

describe("staticMapUrl", () => {
  it("should_build_a_dark_hidpi_map_centred_on_the_listing_with_an_amber_pin", () => {
    const url = new URL(staticMapUrl({ lat: -26.15, lng: 28.03, apiKey: "k&ey", width: 320, height: 160 })!);
    expect(url.origin + url.pathname).toBe("https://api.maptiler.com/maps/base-v4-dark/static/28.03,-26.15,15/320x160@2x.png");
    expect(url.searchParams.get("key")).toBe("k&ey");
    expect(url.searchParams.get("markers")).toBe("28.03,-26.15,#D89B23");
  });

  it("should_return_null_without_a_key_or_valid_coordinates", () => {
    expect(staticMapUrl({ lat: -26, lng: 28, apiKey: "", width: 320, height: 160 })).toBeNull();
    expect(staticMapUrl({ lat: Number.NaN, lng: 28, apiKey: "k", width: 320, height: 160 })).toBeNull();
    expect(staticMapUrl({ lat: 0, lng: 0, apiKey: "k", width: 320, height: 160 })).toBeNull();
  });
});
