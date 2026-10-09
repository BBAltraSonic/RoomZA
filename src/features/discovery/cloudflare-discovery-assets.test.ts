import { describe, it, expect, vi } from "vitest";
import { discoveryAssetResponse } from "../../../cloudflare/discovery-assets.mjs";

describe("prerendered public discovery boundary", () => {
  it("serves a cookie-free shell for every query while retaining security headers", async () => {
    const fetch = vi.fn(async (_request: Request) => new Response("public shell", { headers: { "set-cookie": "never=cache" } }));
    const response = await discoveryAssetResponse(new Request("https://example.test/?view=feed&listingId=home", { headers: { cookie: "session=private" } }), { ASSETS: { fetch } }, [{ key: "content-security-policy", value: "frame-ancestors 'none'" }]);
    expect(fetch.mock.calls[0]?.[0]?.url).toBe("https://example.test/__discovery/index.html");
    expect(fetch.mock.calls[0]?.[0]?.headers.has("cookie")).toBe(false);
    expect(response?.headers.get("set-cookie")).toBeNull();
    expect(response?.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    expect(await response?.text()).toBe("public shell");
  });
  it("keeps private routes, mutations and server actions on the authorized server path", async () => {
    const fetch = vi.fn();
    for (const request of [new Request("https://example.test/dashboard"), new Request("https://example.test/", { method: "POST" }), new Request("https://example.test/", { headers: { "next-action": "action-id" } }), new Request("https://example.test/api/navigation/account")]) {
      expect(await discoveryAssetResponse(request, { ASSETS: { fetch } }, [])).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the matching RSC asset for client navigation", async () => {
    const fetch = vi.fn(async (_request: Request) => new Response("rsc payload"));
    const response = await discoveryAssetResponse(new Request("https://example.test/offers?kind=event&_rsc=x", { headers: { rsc: "1" } }), { ASSETS: { fetch } }, []);
    expect(fetch.mock.calls[0]?.[0]?.url).toBe("https://example.test/__discovery/offers.rsc");
    expect(response?.headers.get("content-type")).toBe("text/x-component");
  });
  it("does not serve a full payload as a segment prefetch", async () => {
    const fetch = vi.fn();
    const response = await discoveryAssetResponse(new Request("https://example.test/services", { headers: { rsc: "1", "next-router-segment-prefetch": "/_tree" } }), { ASSETS: { fetch } }, []);
    expect(response?.status).toBe(204);expect(fetch).not.toHaveBeenCalled();
  });
  it("fails back to the server if a generated asset is missing", async () => {
    expect(await discoveryAssetResponse(new Request("https://example.test/"), { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } }, [])).toBeNull();
  });
});
