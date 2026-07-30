import { describe, expect, it } from "vitest";

import { buildExternalDirectionsUrl } from "./external-directions";

const destination = { lat: -33.9249, lng: 18.4241 };

describe("external directions URLs", () => {
  it("uses Apple Maps on Apple platforms", () => {
    expect(buildExternalDirectionsUrl({
      destination,
      label: "City Bowl home",
      platform: "MacIntel",
    })).toBe("https://maps.apple.com/?daddr=-33.9249,18.4241&q=City%20Bowl%20home");
  });

  it("uses the Android geo handler on supported mobile devices", () => {
    expect(buildExternalDirectionsUrl({
      destination,
      label: "City Bowl home",
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    })).toBe("geo:0,0?q=-33.9249,18.4241(City%20Bowl%20home)");
  });

  it("falls back to browser maps without calling a directions API", () => {
    expect(buildExternalDirectionsUrl({
      destination,
      label: "City Bowl home",
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
    })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-33.9249,18.4241&travelmode=driving&dir_action=navigate",
    );
  });
});
