import { describe, expect, it } from "vitest";
import { discoveryVerticals, isDiscoveryPath, resolveVertical, verticalHref } from "./verticals";

describe("discovery verticals", () => {
  it("should resolve each public discovery route to one environment", () => {
    expect(resolveVertical("/", "")).toBe("property");
    expect(resolveVertical("/services", "")).toBe("service");
    expect(resolveVertical("/offers", "")).toBe("shopping");
    expect(resolveVertical("/offers", "?kind=tourism")).toBe("tourism");
    expect(resolveVertical("/offers", "?kind=event")).toBe("event");
  });

  it("should fall back to shopping for an unknown specials kind", () => {
    expect(resolveVertical("/offers", "?kind=nonsense")).toBe("shopping");
  });

  it("should not treat detail routes as the discovery workspace", () => {
    expect(isDiscoveryPath("/")).toBe(true);
    expect(isDiscoveryPath("/services")).toBe(true);
    expect(isDiscoveryPath("/offers")).toBe(true);
    expect(isDiscoveryPath("/offers/123")).toBe(false);
    expect(isDiscoveryPath("/listing/123")).toBe(false);
  });

  it("should keep the location and map position when changing environment", () => {
    const href = verticalHref("service", "?areaId=a1&area=Sandton&bbox=1,2,3,4&q=cheap&sort=Nearest&quick=pet&listingId=x&mode=buy");
    const url = new URL(href, "https://pinpoint.invalid");
    expect(url.pathname).toBe("/services");
    expect(Object.fromEntries(url.searchParams)).toEqual({ areaId: "a1", area: "Sandton", bbox: "1,2,3,4", q: "cheap", sort: "Nearest", view: "map" });
  });

  it("should drop a services-only filter when leaving services", () => {
    const url = new URL(verticalHref("shopping", "?serviceType=Plumbing&areaId=a1"), "https://pinpoint.invalid");
    expect(url.pathname).toBe("/offers");
    expect(url.searchParams.has("serviceType")).toBe(false);
    expect(url.searchParams.get("areaId")).toBe("a1");
  });

  it("should restore property-only state when returning to property", () => {
    const url = new URL(verticalHref("property", "?areaId=a1&bbox=1,2,3,4&kind=event&view=map", "?mode=buy&beds=2"), "https://pinpoint.invalid");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("mode")).toBe("buy");
    expect(url.searchParams.get("beds")).toBe("2");
    expect(url.searchParams.get("areaId")).toBe("a1");
    expect(url.searchParams.has("kind")).toBe(false);
    expect(url.searchParams.has("bbox")).toBe(false);
  });

  it("should encode the specials kind only for non-shopping environments", () => {
    expect(verticalHref("tourism", "")).toContain("kind=tourism");
    expect(verticalHref("event", "")).toContain("kind=event");
    expect(verticalHref("shopping", "?kind=event")).not.toContain("kind=");
  });

  it("should give every environment a document title", () => {
    for (const vertical of Object.values(discoveryVerticals)) expect(vertical.title.length).toBeGreaterThan(0);
  });
});
