import { beforeEach, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("@/features/discovery/viewport-data", () => ({ readDiscoveryViewport: read }));
import { GET } from "./route";
const request = (query: string) => new Request("https://pinpoint.invalid/api/discovery/viewport?" + query);
beforeEach(() => { read.mockReset(); });
it("accepts bounds without an area and returns an uncached public response", async () => {
  read.mockResolvedValue({ category: "shopping", items: [], totalCount: 0 });
  const response = await GET(request("category=shopping&bbox=18,-34,19,-33&q=cafe"));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(read.mock.calls[0]?.[0]).toEqual({ category: "shopping", bounds: { west:18,south:-34,east:19,north:-33 }, q:"cafe", sort:"Ending soon", serviceType:"All services" });
});
it.each([
  "category=shopping", "category=property&bbox=18,-34,19,-33", "category=event&bbox=19,-34,18,-33",
  "category=event&bbox=NaN,-34,19,-33", "category=event&bbox=18,-90,19,33", "category=event&bbox=18,-34,19,-33&category=tourism",
  "category=event&bbox=18,-34,19,-33&serviceType=Cleaning", "category=service&bbox=18,-34,19,-33&sort=Ending+soon",
  "category=shopping&bbox=18,-34,19,-33&areaId=whatever", "category=shopping&bbox=18,-34,19,-33&q="+"x".repeat(121),
])("rejects malformed or unsupported queries: %s", async query => {
  expect((await GET(request(query))).status).toBe(400); expect(read).not.toHaveBeenCalled();
});
it("preserves service filters and hides database errors", async () => {
  read.mockRejectedValue(new Error("private review evidence"));
  const response = await GET(request("category=service&bbox=18,-34,19,-33&serviceType=Plumbing"));
  expect(read.mock.calls[0]?.[0]).toMatchObject({ serviceType: "Plumbing", sort: "Latest" });
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("private review");
});
