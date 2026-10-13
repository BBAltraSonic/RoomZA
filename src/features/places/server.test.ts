import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), read: vi.fn(), forward: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/places/catalogue", () => ({ searchLocationCatalogue: mocks.search, readLocationCatalogue: mocks.read }));
vi.mock("@/lib/maptiler", () => ({ forwardGeocode: mocks.forward }));
import { getDiscoveryPlace, searchDiscoveryPlaces } from "./server";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("uses catalogue autocomplete even with a configured map provider key", async () => {
  vi.stubEnv("NEXT_PUBLIC_MAPTILER_API_KEY", "configured");
  const place = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Soweto" };
  mocks.search.mockResolvedValue({ data: { places: [place] } });
  expect(await searchDiscoveryPlaces("Sowteo")).toEqual([place]);
  expect(mocks.search).toHaveBeenCalledWith("Sowteo");
  expect(mocks.forward).not.toHaveBeenCalled();
});
it("rehydrates stable IDs without losing extent metadata and propagates failure", async () => {
  mocks.read.mockResolvedValue([{ id: "id", extentKind: "viewport" }]);
  expect(await getDiscoveryPlace("id")).toMatchObject({ extentKind: "viewport" });
  mocks.search.mockRejectedValue(new Error("offline"));
  await expect(searchDiscoveryPlaces("Soweto")).rejects.toThrow("offline");
});
