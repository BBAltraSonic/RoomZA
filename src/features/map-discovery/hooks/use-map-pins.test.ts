// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMapPins, type PinSignals } from "./use-map-pins";

type TestPin = { id: string; coordinates: { lat: number; lng: number }; live: boolean; amount?: number };
const bounds = { west: 17, south: -35, east: 20, north: -32 };
const pin = (id: string, lng: number, live: boolean, amount?: number): TestPin => ({ id, coordinates: { lat: -33.9, lng }, live, amount });
const signals = ({ live, amount }: TestPin): PinSignals => ({ live, price: amount });

describe("useMapPins", () => {
  it("should summarise what a cluster hides", () => {
    const pins = [pin("a", 18.4, true, 900), pin("b", 18.4001, false, 450), pin("c", 18.4002, true)];
    const { result } = renderHook(() => useMapPins(pins, bounds, 10, undefined, signals));

    expect(result.current.clusters).toHaveLength(1);
    expect(result.current.clusters[0]).toMatchObject({ count: 3, liveCount: 2, fromPrice: 450 });
  });

  it("should rank live pins ahead of the marker budget", () => {
    const pins = [...Array.from({ length: 70 }, (_, index) => pin(`calm-${index}`, 17.1 + index * 0.04, false)), pin("live", 19.9, true)];
    const { result } = renderHook(() => useMapPins(pins, bounds, 22, undefined, signals));

    expect(result.current.singles.map(item => item.id)).toContain("live");
    expect(result.current.singles[0]?.id).toBe("live");
  });
});
