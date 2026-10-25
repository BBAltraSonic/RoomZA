import { afterEach, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ resolve4: vi.fn().mockResolvedValue([]), resolve6: vi.fn().mockResolvedValue([]) }));
vi.mock("node:dns/promises", () => dns);
// Literal policy is independent of the native socket/TLS connection suite.
vi.mock("./node-image-transport", () => ({ hasNativeNodeHttps: false }));
vi.mock("./edge-image-transport", () => ({ fetchPinnedEdgeImage: (url: URL) => fetch(url) }));
import { fetchSafeImage } from "@/features/listing-imports/safe-image-url";
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("accepts a public IPv6 literal without treating brackets as a DNS hostname", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(png)); vi.stubGlobal("fetch", fetcher);
  const image = await fetchSafeImage("https://[2606:4700:4700::1111]/photo.png");
  expect(image.bytes).toEqual(png); expect(fetcher).toHaveBeenCalledOnce(); expect(dns.resolve4).not.toHaveBeenCalled(); expect(dns.resolve6).not.toHaveBeenCalled();
});
it("refuses a private IPv6 literal before DNS or image transport", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(fetchSafeImage("https://[::1]/photo.png")).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled(); expect(dns.resolve4).not.toHaveBeenCalled(); expect(dns.resolve6).not.toHaveBeenCalled();
});
it("refuses a documentation IPv4 literal before any image transport", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(fetchSafeImage("https://192.0.2.1/photo.png")).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled(); expect(dns.resolve4).not.toHaveBeenCalled(); expect(dns.resolve6).not.toHaveBeenCalled();
});
