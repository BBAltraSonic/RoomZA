import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryApiPaths, discoveryApiResponse } from "../../cloudflare/discovery-api-routing.mjs";
import { requestContext, setCookies, withRequestContext } from "../../workers/discovery-api/request-context.mjs";

const mocks = vi.hoisted(() => ({ handler: vi.fn(), client: vi.fn() }));
vi.mock("../../src/app/api/listings/route", () => ({ GET: mocks.handler }));
vi.mock("../../src/app/api/discovery/viewport/route", () => ({ GET: mocks.handler }));
vi.mock("../../src/app/api/saved-specials/route", () => ({ GET: mocks.handler }));
vi.mock("../../src/app/api/favorites/route", () => ({ GET: mocks.handler }));
vi.mock("../../src/app/api/notifications/route", () => ({ GET: mocks.handler }));
vi.mock("../../workers/discovery-api/supabase-server", () => ({ createClient: mocks.client }));
import worker from "../../workers/discovery-api/worker";

const request = (path: string, init?: RequestInit) => new Request("https://roomza.test" + path, init);
const internalRequest = (path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("authorization", "RoomzaInternal " + btoa("{}"));
  return request(path, { ...init, headers });
};
beforeEach(() => {
  mocks.handler.mockReset().mockImplementation(async () => Response.json({ results: [] }));
  mocks.client.mockReset().mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
});
afterEach(() => vi.restoreAllMocks());

describe("discovery API service boundary", () => {
  it("forwards only the exact read allowlist with cookies and security headers intact", async () => {
    const fetch = vi.fn(async (input: Request) => {
      expect(input.headers.get("cookie")).toBe("session=caller");
      return new Response("results", { headers: { "set-cookie": "rotated=token", "cache-control": "private, no-store" } });
    });
    for (const path of discoveryApiPaths) {
      const response = await discoveryApiResponse(request(path, { headers: { cookie: "session=caller" } }), { DISCOVERY_API: { fetch } }, [{ key: "content-security-policy", value: "default-src 'self'" }]);
      expect(response?.headers.get("content-security-policy")).toBe("default-src 'self'");
      expect(response?.headers.get("set-cookie")).toBe("rotated=token");
      expect(response?.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("keeps writes, server actions, private pages and unlisted reads on Next", async () => {
    const fetch = vi.fn();
    for (const input of [request("/api/listings", { method: "POST" }), request("/api/saved-specials", { method: "DELETE" }), request("/api/notifications", { method: "PATCH" }), request("/api/listings", { headers: { "next-action": "action" } }), request("/api/listings/id"), request("/api/navigation/account"), request("/saved")]) {
      expect(await discoveryApiResponse(input, { DISCOVERY_API: { fetch } }, [])).toBeNull();
      expect((await worker.fetch(input)).status).toBe(404);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("falls through safely before the service is bound", async () => {
    expect(await discoveryApiResponse(request("/api/listings"), {}, [])).toBeNull();
  });

  it("rejects direct calls and replaces externally supplied credentials at the binding", async () => {
    expect((await worker.fetch(request("/api/listings"))).status).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
    const fetch = vi.fn(async (input: Request) => {
      const credentials = JSON.parse(atob(input.headers.get("authorization")!.slice("RoomzaInternal ".length)));
      expect(credentials).toEqual({ SUPABASE_SERVICE_ROLE_KEY: "existing-server-credential" });
      return new Response("results");
    });
    await discoveryApiResponse(request("/api/listings", { headers: { authorization: "external-caller" } }), { DISCOVERY_API: { fetch }, SUPABASE_SERVICE_ROLE_KEY: "existing-server-credential" }, []);
  });

  it("blocks suspended callers before reading any endpoint", async () => {
    const rpc = vi.fn(async () => ({ data: false }));
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "caller" } } }) }, rpc });
    const response = await worker.fetch(internalRequest("/api/saved-specials"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "account_suspended" } });
    expect(rpc).toHaveBeenCalledWith("is_current_account_active");
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it("retains refreshed cookies and the request ID for an active caller", async () => {
    mocks.client.mockImplementation(async () => {
      setCookies([{ name: "session", value: "refreshed", options: { httpOnly: true, secure: true, sameSite: "lax" } }]);
      return { auth: { getUser: async () => ({ data: { user: { id: "caller" } } }) }, rpc: async () => ({ data: true }) };
    });
    mocks.handler.mockImplementation(async () => {
      expect(requestContext().cookies.get("session")).toBe("refreshed");
      return new Response("results", { headers: { "cache-control": "public, max-age=30" } });
    });
    const response = await worker.fetch(internalRequest("/api/listings", { headers: { "x-request-id": "test-request", cookie: "session=old" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("test-request");
    expect(response.headers.get("set-cookie")).toContain("session=refreshed");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not expose private errors or cache failures", async () => {
    mocks.handler.mockRejectedValue(new Error("private database credentials"));
    const response = await worker.fetch(internalRequest("/api/listings"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("credentials");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("isolates cookies and clients across interleaved concurrent requests", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = withRequestContext(request("/api/listings", { headers: { cookie: "session=first" } }), async () => {
      requestContext().client = { id: "first" };
      await gate;
      expect(requestContext().cookies.get("session")).toBe("first");
      expect(requestContext().client).toEqual({ id: "first" });
      setCookies([{ name: "session", value: "rotated-first", options: {} }]);
      return new Response("first");
    });
    const second = await withRequestContext(request("/api/listings", { headers: { cookie: "session=second" } }), async () => {
      expect(requestContext().cookies.get("session")).toBe("second");
      expect(requestContext().client).toBeNull();
      release();
      return new Response("second");
    });
    expect(second.headers.get("set-cookie")).toBeNull();
    expect((await first).headers.get("set-cookie")).toContain("rotated-first");
    expect(() => requestContext()).toThrow("request context");
  });
});
