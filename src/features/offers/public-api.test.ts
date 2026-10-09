import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const reads = vi.hoisted(() => ({ readPublicOffer: vi.fn(), readPublicOfferAction: vi.fn(), readPublicOfferCount: vi.fn(), readPublicOfferFeed: vi.fn() }));
vi.mock("./public-data", () => reads);
import { handlePublicOfferDetail, handlePublicOfferDirections, handlePublicOfferFeed } from "./public-api";
const id = "00000000-0000-4000-8000-000000000001";
const request = (suffix = "") => new Request(`https://pinpoint.example/api/offers${suffix}`);
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });
describe("public offer HTTP boundary", () => {
  it("rejects missing, repeated, forged or incomplete inputs before database reads", async () => {
    for (const suffix of ["", `?areaId=${id}&areaId=${id}`, `?areaId=${id}&actorId=${id}`, `?areaId=${id}&afterOfferId=${id}`]) expect((await handlePublicOfferFeed(request(suffix))).status).toBe(400);
    expect((await handlePublicOfferDirections(request("?destination=https://elsewhere.invalid"), id)).status).toBe(400);
    expect(reads.readPublicOfferFeed).not.toHaveBeenCalled();
    expect(reads.readPublicOfferAction).not.toHaveBeenCalled();
  });
  it("returns current public count with no caching and maps inactive detail statuses", async () => {
    reads.readPublicOfferCount.mockResolvedValue({ totalCount: 0 });
    const count = await handlePublicOfferFeed(request(`?areaId=${id}`), true);
    expect(await count.json()).toEqual({ totalCount: 0 });
    expect(count.headers.get("cache-control")).toContain("no-store");
    for (const [status, code] of [["unavailable", 404], ["expired", 410], ["scheduled", 200]]) {
      reads.readPublicOffer.mockResolvedValue({ status });
      expect((await handlePublicOfferDetail(request(), id)).status).toBe(code);
    }
  });
  it("uses a fixed maps host and exact reviewed coordinates, excluding origin/contact facts", async () => {
    reads.readPublicOfferAction.mockResolvedValue({ serverNow: "2026-10-02T10:00:00Z", endsAt: "2026-10-02T11:00:00Z", latitude: -33.96, longitude: 18.47 });
    const response = await handlePublicOfferDirections(request(), id);
    const location = new URL(response.headers.get("location")!);
    expect(response.status).toBe(302);
    expect(location.origin).toBe("https://www.google.com");
    expect(location.pathname).toBe("/maps/dir/");
    expect([...location.searchParams.entries()]).toEqual([["api", "1"], ["destination", "-33.96,18.47"]]);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("denies a destination after RPC elapsed time consumes its remaining validity", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(1100);
    reads.readPublicOfferAction.mockResolvedValue({ serverNow: "2026-10-02T10:00:00Z", endsAt: "2026-10-02T10:00:01Z" });
    const response = await handlePublicOfferDirections(request(), id);
    expect(response.status).toBe(410);
    expect(response.headers.has("location")).toBe(false);
  });
  it("returns a fresh bounded destination for the screen without following an external redirect", async () => {
    reads.readPublicOfferAction.mockResolvedValue({ serverNow: "2026-10-02T10:00:00Z", endsAt: "2026-10-02T11:00:00Z", latitude: -33.97, longitude: 18.48 });
    const response = await handlePublicOfferDirections(new Request("https://pinpoint.example/api/offers/" + id + "/directions", { headers: { Accept: "application/json" } }), id);
    expect(response.status).toBe(200);
    expect(response.headers.has("location")).toBe(false);
    expect(await response.json()).toEqual({ destination: "https://www.google.com/maps/dir/?api=1&destination=-33.97%2C18.48", serverNow: "2026-10-02T10:00:00Z", endsAt: "2026-10-02T11:00:00Z" });
  });
  it("never redirects unavailable records and hides database diagnostics", async () => {
    reads.readPublicOfferAction.mockResolvedValue(null);
    expect((await handlePublicOfferDirections(request(), id)).status).toBe(410);
    reads.readPublicOffer.mockRejectedValue(new Error("private database detail"));
    const response = await handlePublicOfferDetail(request(), id);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database");
  });
});
