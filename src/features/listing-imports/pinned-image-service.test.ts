import { expect, it, vi } from "vitest";
import { servePinnedImageHop } from "./pinned-image-service";
const input = { url: "https://images.example.com/photo%20one.png?key=a%2Fb", addresses: ["8.8.8.8"] };
function connection(response: string) {
  const bytes = new TextEncoder().encode(response); let offset = 0;
  const close = vi.fn(), written: Uint8Array[] = [];
  return { close, written, async write(value: Uint8Array) { const count = Math.min(3, value.length); written.push(value.slice(0, count)); return count; }, async read(buffer: Uint8Array) { if (offset === bytes.length) return null; const count = Math.min(7, buffer.length, bytes.length - offset); buffer.set(bytes.subarray(offset, offset + count)); offset += count; return count; } };
}
it("dials only checked addresses and preserves TLS identity, Host and encoded request target", async () => {
  const peer = connection("HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nabc"), connect = vi.fn(async () => peer);
  const signal = AbortSignal.timeout(1000);
  const response = await servePinnedImageHop(input, signal, connect);
  expect(connect).toHaveBeenCalledExactlyOnceWith("8.8.8.8", "images.example.com", signal);
  expect(new TextDecoder().decode(Uint8Array.from(peer.written.flatMap(x => [...x])))).toContain("GET /photo%20one.png?key=a%2Fb HTTP/1.1\r\nHost: images.example.com\r\n");
  expect(await response.text()).toBe("abc"); expect(peer.close).toHaveBeenCalledOnce();
});
it.each([
  { ...input, addresses: ["8.8.8.8", "127.0.0.1"] },
  { ...input, addresses: ["::ffff:127.0.0.1"] },
  { ...input, addresses: [] },
  { ...input, url: "https://127.0.0.1/photo.png" },
  { ...input, url: "https://localhost/photo.png" },
  { ...input, url: "https://user:password@example.com/photo.png" },
  { ...input, url: "http://example.com/photo.png" },
])("refuses unsafe input before any socket is created (%#)", async value => {
  const connect = vi.fn(); await expect(servePinnedImageHop(value, AbortSignal.timeout(1000), connect)).rejects.toThrow(); expect(connect).not.toHaveBeenCalled();
});
it("returns a redirect without following it or forwarding private headers", async () => {
  const peer = connection("HTTP/1.1 302 Found\r\nLocation: https://127.0.0.1/private\r\nSet-Cookie: private=secret\r\n\r\n"), connect = vi.fn(async () => peer);
  const response = await servePinnedImageHop(input, AbortSignal.timeout(1000), connect);
  expect(response.status).toBe(302); expect(response.headers.get("location")).toContain("127.0.0.1"); expect(response.headers.has("set-cookie")).toBe(false); expect(connect).toHaveBeenCalledOnce(); expect(peer.close).toHaveBeenCalledOnce();
});
it("closes the socket on a truncated response and does not retry the request", async () => {
  const peer = connection("HTTP/1.1 200 OK\r\nContent-Length: 30\r\n\r\nabc"), connect = vi.fn(async () => peer);
  await expect(servePinnedImageHop(input, AbortSignal.timeout(1000), connect)).rejects.toThrow("ended early"); expect(peer.close).toHaveBeenCalledOnce(); expect(connect).toHaveBeenCalledOnce();
});
it("refuses an already cancelled request before connecting", async () => {
  const connect = vi.fn(); await expect(servePinnedImageHop(input, AbortSignal.abort(), connect)).rejects.toThrow(); expect(connect).not.toHaveBeenCalled();
});
