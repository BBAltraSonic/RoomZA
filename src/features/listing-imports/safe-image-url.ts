import "server-only";

import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";

import { IMPORT_LIMITS } from "./limits";
import { fetchPinnedNodeImage, hasNativeNodeHttps } from "./node-image-transport";
import { fetchPinnedEdgeImage } from "./edge-image-transport";

import { detectImageMime, isPublicAddress, parseSafeImageUrl } from "./image-url-policy";
export { detectImageMime, isPublicAddress, parseSafeImageUrl } from "./image-url-policy";

async function publicHostAddresses(url: URL, signal: AbortSignal) {
  const hostname = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error("Private-network image URLs are not allowed.");
    return [hostname];
  }
  signal.throwIfAborted();
  let abort: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  let ipv4: string[], ipv6: string[];
  try { [ipv4, ipv6] = await Promise.race([Promise.all([
    resolve4(url.hostname).catch(() => []),
    resolve6(url.hostname).catch(() => []),
  ]), aborted]); } finally { signal.removeEventListener("abort", abort); }
  const addresses = [...ipv4, ...ipv6];
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error("The image host does not resolve to a public address.");
  }
  return addresses;
}

export async function fetchSafeImage(input: string) {
  let url = parseSafeImageUrl(input);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const signal = AbortSignal.timeout(20_000);
    const addresses = await publicHostAddresses(url, signal);
    // A failed pinned Node request must NEVER retry through unpinned global fetch.
    // Workers delegates this checked address set to the authenticated TLS service.
    // Neither transport falls back to an unpinned request after a failure.
    const response = hasNativeNodeHttps
      ? await fetchPinnedNodeImage(url, addresses, signal)
      : await fetchPinnedEdgeImage(url, addresses, signal);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location || redirects === 3) throw new Error("The image URL redirected too many times.");
      url = parseSafeImageUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok || !response.body) throw new Error("The image could not be downloaded.");
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > IMPORT_LIMITS.imageBytes) {
      await response.body.cancel().catch(() => undefined);
      throw new Error("Images are limited to 10 MB.");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > IMPORT_LIMITS.imageBytes) throw new Error("Images are limited to 10 MB.");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    const mimeType = detectImageMime(buffer);
    if (!mimeType) throw new Error("The downloaded file is not a supported image.");
    return { bytes: buffer, mimeType, finalUrl: url };
  }
  throw new Error("The image could not be downloaded.");
}
