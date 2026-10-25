import { afterEach, expect, it, vi } from "vitest";
import { fetchPinnedEdgeImage } from "./edge-image-transport";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("sends the checked address set only to the authenticated project endpoint with manual redirects", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "owned-server-only-fixture");
  const result = new Response("image", { headers: { "x-roomza-image-transport": "pinned-tls-v1" } });
  const fetcher = vi.fn().mockResolvedValue(result); vi.stubGlobal("fetch", fetcher);
  const url = new URL("https://images.example.com/image.png"), signal = AbortSignal.timeout(1000);
  expect(await fetchPinnedEdgeImage(url, ["8.8.8.8"], signal)).toBe(result);
  const [endpoint, init] = fetcher.mock.calls[0]!;
  expect(endpoint.toString()).toBe("https://project.supabase.co/functions/v1/import-image");
  expect(init).toMatchObject({ method: "POST", redirect: "manual", cache: "no-store", signal, headers: { authorization: "Bearer owned-server-only-fixture" } });
  expect(JSON.parse(init.body)).toEqual({ url: url.toString(), addresses: ["8.8.8.8"] });
  expect(fetcher).toHaveBeenCalledOnce();
});
it("fails closed on an unrecognized response without following a redirect or using unpinned fetch", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "owned-server-only-fixture");
  const fetcher = vi.fn().mockResolvedValue(new Response("denied", { status: 302, headers: { location: "https://other.example" } })); vi.stubGlobal("fetch", fetcher);
  await expect(fetchPinnedEdgeImage(new URL("https://images.example.com/a.png"), ["8.8.8.8"], AbortSignal.timeout(1000))).rejects.toThrow("unavailable"); expect(fetcher).toHaveBeenCalledOnce();
});
it("never sends a request without server configuration", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", ""); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(fetchPinnedEdgeImage(new URL("https://images.example.com/a.png"), ["8.8.8.8"], AbortSignal.timeout(1000))).rejects.toThrow("unavailable"); expect(fetcher).not.toHaveBeenCalled();
});
