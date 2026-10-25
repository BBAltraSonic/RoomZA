import { isIP } from "node:net";
import { decodeImageHttpBody, readImageHttpResponse, type ImageSocketReader } from "./http-image-response";
import { isPublicAddress, parseSafeImageUrl } from "./image-url-policy";
import { IMPORT_LIMITS } from "./limits";

export type PinnedImageSocket = ImageSocketReader & {
  write(bytes: Uint8Array): Promise<number>;
  close(): void;
};
export type ConnectPinnedImage = (address: string, identity: string, signal: AbortSignal) => Promise<PinnedImageSocket>;

/** One hop only; the app revalidates each redirect before another authenticated call. */
export async function servePinnedImageHop(input: unknown, signal: AbortSignal, connect: ConnectPinnedImage) {
  if (!input || typeof input !== "object") throw new Error("Invalid image request.");
  const { url: supplied, addresses } = input as { url?: unknown; addresses?: unknown };
  if (typeof supplied !== "string" || supplied.length > 8192 || !Array.isArray(addresses) || !addresses.length || addresses.length > 64 || addresses.some(x => typeof x !== "string" || !isPublicAddress(x))) throw new Error("Invalid public image destination.");
  const url = parseSafeImageUrl(supplied), hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) && !addresses.includes(hostname)) throw new Error("The image address changed before connecting.");
  const request = new TextEncoder().encode(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\nAccept: image/jpeg,image/png,image/webp\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
  let socket: PinnedImageSocket | undefined, lastError: unknown;
  for (const address of [...new Set<string>(addresses)]) {
    signal.throwIfAborted();
    try { socket = await connect(address, hostname, signal); break; }
    catch (error) { lastError = error; }
  }
  if (!socket) throw lastError ?? new Error("The image host could not be reached.");
  const active = socket;
  const abort = () => { try { active.close(); } catch { /* Already closed. */ } };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    let offset = 0;
    while (offset < request.length) {
      const count = await active.write(request.subarray(offset));
      if (count < 1 || count > request.length - offset) throw new Error("The image request could not be sent.");
      offset += count;
    }
    const response = await readImageHttpResponse(active, IMPORT_LIMITS.imageBytes);
    const headers = new Headers({ "x-roomza-image-transport": "pinned-tls-v1", "cache-control": "private, no-store" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) headers.set("location", location);
      return new Response(null, { status: response.status, headers });
    }
    if (response.status < 200 || response.status >= 300 || response.status === 204 || response.status === 205) return new Response(null, { status: 502, headers });
    const bytes = await decodeImageHttpBody(response.bytes, response.headers.get("content-encoding"), IMPORT_LIMITS.imageBytes);
    signal.throwIfAborted();
    headers.set("content-length", String(bytes.length));
    headers.set("content-type", "application/octet-stream");
    // Signature validation and registration stay in the existing app command.
    return new Response(new Uint8Array(bytes), { status: 200, headers });
  } finally { signal.removeEventListener("abort", abort); abort(); }
}
