import { describe, expect, it } from "vitest";

import {
  animatedPinIds,
  belowNearbyPercents,
  eventWhenLabel,
  formatPinDistance,
  offerName,
  servicePinContent,
  specialPinContent,
  viewingNowLabel,
} from "./pin-content";

describe("offerName", () => {
  it("should strip advertising filler and the price from a title", () => {
    expect(offerName("Family meal special for R45")).toBe("Family meal");
    expect(offerName("R45 family meal")).toBe("Family meal");
    expect(offerName("Special: Burger combo")).toBe("Burger combo");
  });

  it("should return nothing when a title says nothing about the offer", () => {
    expect(offerName("Special ad")).toBeUndefined();
    expect(offerName("Today's special")).toBeUndefined();
  });

  it("should keep a word that only looks like filler inside the name", () => {
    expect(offerName("Shoe sale")).toBe("Shoe sale");
  });

  it("should shorten long names at a word boundary", () => {
    expect(offerName("Slow roasted lamb shank with seasonal vegetables")).toBe("Slow roasted lamb…");
  });
});

describe("specialPinContent", () => {
  it("should lead with the price and name what it buys", () => {
    expect(specialPinContent({ title: "Family meal special", identity: "Chicken Shack", priceCents: 4500 })).toEqual({ headline: "R45", detail: "Family meal" });
  });

  it("should show the saving when an original price exists", () => {
    expect(specialPinContent({ title: "Family meal", identity: "Chicken Shack", priceCents: 4500, originalPriceCents: 9000 }).tag).toBe("50% off");
  });

  it("should read the price from the title when the price field is empty", () => {
    expect(specialPinContent({ title: "R45 family meal", identity: "Chicken Shack" })).toEqual({ headline: "R45", detail: "Family meal" });
  });

  it("should lead with the deal when there is no price", () => {
    expect(specialPinContent({ title: "2 for 1 pizzas", identity: "Luigi's" }).headline).toBe("2 for 1");
    expect(specialPinContent({ title: "20% off all shoes", identity: "Sole" }).headline).toBe("20% off");
  });

  it("should fall back to the benefit when the title is generic", () => {
    expect(specialPinContent({ title: "Special ad", benefit: "Free coffee with any cake", identity: "Bean" })).toEqual({ headline: "Free coffee with any…", detail: "Bean" });
  });

  it("should fall back to the business when nothing else is meaningful", () => {
    expect(specialPinContent({ title: "Special ad", identity: "Bean" })).toEqual({ headline: "Bean" });
  });

  it("should label a free special as free", () => {
    expect(specialPinContent({ title: "Kids eat", identity: "Bean", priceCents: 0 }).headline).toBe("Free");
  });
});

describe("eventWhenLabel", () => {
  const now = Date.parse("2026-10-30T10:00:00+02:00"); // Friday
  const end = "2026-12-30T23:00:00+02:00";

  it("should say an event is on now once it has started", () => {
    expect(eventWhenLabel("2026-10-30T09:00:00+02:00", end, now)).toBe("On now");
  });

  it("should use today and tomorrow in South African time", () => {
    expect(eventWhenLabel("2026-10-30T19:00:00+02:00", end, now)).toBe("Today 19:00");
    expect(eventWhenLabel("2026-10-30T23:30:00Z", end, now)).toBe("Tomorrow 01:30");
  });

  it("should use the weekday within a week and the date after that", () => {
    expect(eventWhenLabel("2026-11-02T18:00:00+02:00", end, now)).toBe("Mon 18:00");
    expect(eventWhenLabel("2026-11-20T18:00:00+02:00", end, now)).toBe("20 Nov");
  });
});

describe("servicePinContent", () => {
  it("should name the tradesperson and provider when no price is published", () => {
    expect(servicePinContent({ title: "Geysers fixed", providerName: "Sipho's Plumbing", serviceType: "Plumbing" })).toEqual({ headline: "Plumber", detail: "Sipho's Plumbing" });
  });

  it("should lead with the starting price when one is published", () => {
    expect(servicePinContent({ title: "Geysers", providerName: "Sipho's", serviceType: "Plumbing", priceFromCents: 35000, priceUnit: "hour" })).toEqual({ headline: "From R350/hr", detail: "Plumber" });
    expect(servicePinContent({ title: "Geysers", providerName: "Sipho's", serviceType: "Plumbing", priceFromCents: 35000, priceUnit: "callout" }).headline).toBe("R350 call-out");
    expect(servicePinContent({ title: "Geysers", providerName: "Sipho's", serviceType: "Plumbing", priceFromCents: 35000, priceUnit: "job" }).headline).toBe("From R350");
  });

  it("should use the listing title for an uncategorised service", () => {
    expect(servicePinContent({ title: "Pool repairs", providerName: "Blue", serviceType: "Other" }).headline).toBe("Pool repairs");
  });
});

describe("formatPinDistance", () => {
  it("should round for the distance a person can act on", () => {
    expect(formatPinDistance(0.04)).toBe("50 m");
    expect(formatPinDistance(0.449)).toBe("450 m");
    expect(formatPinDistance(1.26)).toBe("1.3 km");
    expect(formatPinDistance(12.4)).toBe("12 km");
  });
});

describe("belowNearbyPercents", () => {
  const home = (id: string, price: number, beds = 2) => ({ id, price, beds });
  const options = { group: (item: ReturnType<typeof home>) => String(item.beds), price: (item: ReturnType<typeof home>) => item.price };

  it("should report how far a price sits below comparable homes", () => {
    const homes = [home("a", 8000), home("b", 10000), home("c", 10000), home("d", 10000), home("e", 12000)];
    expect(belowNearbyPercents(homes, options)).toEqual(new Map([["a", 20]]));
  });

  it("should stay silent without enough comparable homes", () => {
    const homes = [home("a", 8000), home("b", 10000), home("c", 12000), home("d", 10000, 3), home("e", 10000, 3)];
    expect(belowNearbyPercents(homes, options).size).toBe(0);
  });

  it("should ignore trivial gaps and implausible outliers", () => {
    const homes = [home("a", 9800), home("b", 10000), home("c", 10000), home("d", 10000), home("e", 2000)];
    expect(belowNearbyPercents(homes, options).size).toBe(0);
  });
});

describe("viewingNowLabel", () => {
  it("should keep counts rounded and hide a lone viewer", () => {
    expect(viewingNowLabel(1)).toBeUndefined();
    expect(viewingNowLabel(3)).toBe("A few viewing");
    expect(viewingNowLabel(12)).toBe("About 10 viewing");
  });
});

describe("animatedPinIds", () => {
  it("should animate only the most important pins within the budget", () => {
    const pins = [{ id: "calm", attention: 0 }, { id: "low", attention: 1 }, { id: "high", attention: 3 }, { id: "mid", attention: 2 }];
    expect(animatedPinIds(pins, 2)).toEqual(new Set(["high", "mid"]));
  });
});
