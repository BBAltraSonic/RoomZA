import "server-only";

import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { PassThrough, Readable, Transform, pipeline } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

import { IMPORT_LIMITS } from "./limits";

// Workers exposes Node-shaped process fields but has no native OpenSSL transport.
// Its node:https wrapper ignores lookup; never route it through this implementation.
export const hasNativeNodeHttps = process.release.name === "node"
  && Boolean(process.versions.openssl) && globalThis.navigator?.userAgent !== "Cloudflare-Workers";

/** Internal transport: the caller must first validate EVERY supplied address. */
export function fetchPinnedNodeImage(url: URL, addresses: string[], signal: AbortSignal): Promise<Response> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const approved = addresses.map(address => {
    const family = isIP(address);
    if (!family) throw new Error("The image address is invalid.");
    return { address, family };
  });
  if (!approved.length) throw new Error("The image host has no approved address.");
  if (isIP(hostname) && !addresses.includes(hostname)) throw new Error("The image address changed before connecting.");
  const lookup: LookupFunction = (host, options, callback) => {
    if (host !== hostname) return callback(new Error("The image host changed before connecting."), "");
    // Return ONLY this hop's checked answers, including Node's family fallback.
    // No system resolver, shared agent pool or subsequent hostname lookup is used.
    if (options.all) callback(null, approved);
    else callback(null, approved[0]!.address, approved[0]!.family);
  };
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET", agent: false, lookup, autoSelectFamily: true,
      servername: isIP(hostname) ? undefined : hostname,
      rejectUnauthorized: true, maxHeaderSize: 16_384, signal,
      headers: { accept: "image/jpeg,image/png,image/webp", "accept-encoding": "identity" },
    };
    const outgoing = request(url, options, incoming => {
      try {
        const headers = new Headers();
        for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
          headers.append(incoming.rawHeaders[index]!, incoming.rawHeaders[index + 1]!);
        }
        const status = incoming.statusCode ?? 502;
        // Redirect policy stays in fetchSafeImage, which validates the next hop.
        if (status >= 300 || status === 204 || status === 205) {
          incoming.destroy(); resolve(new Response(null, { status, headers })); return;
        }
        if (Number(headers.get("content-length") ?? 0) > IMPORT_LIMITS.imageBytes) throw new Error("Images are limited to 10 MB.");
        const encodings = (headers.get("content-encoding") ?? "identity").split(",").map(value => value.trim().toLowerCase()).filter(value => value !== "identity");
        if (encodings.length > 3) throw new Error("The image encoding is not supported.");
        const decoders = encodings.reverse().map(encoding => {
          if (encoding === "gzip" || encoding === "x-gzip") return createGunzip();
          if (encoding === "deflate") return createInflate();
          if (encoding === "br") return createBrotliDecompress();
          throw new Error("The image encoding is not supported.");
        });
        if (decoders.length) { headers.delete("content-encoding"); headers.delete("content-length"); }
        let encodedBytes = 0;
        const bounded = new Transform({ transform(chunk: Buffer, _encoding, callback) {
          encodedBytes += chunk.byteLength;
          callback(encodedBytes > IMPORT_LIMITS.imageBytes ? new Error("Images are limited to 10 MB.") : null, chunk);
        } });
        const output = new PassThrough();
        // Pipeline propagates cancellation/errors through the decoder and socket.
        // The caller separately bounds decoded image bytes while reading this body.
        pipeline([incoming, bounded, ...decoders, output], error => { if (error) output.destroy(error); });
        resolve(new Response(Readable.toWeb(output) as ReadableStream<Uint8Array>, { status, headers }));
      } catch (error) { incoming.destroy(); reject(error); }
    });
    outgoing.once("error", reject);
    outgoing.once("upgrade", (_response, socket) => { socket.destroy(); reject(new Error("Image downloads cannot upgrade the connection.")); });
    outgoing.end();
  });
}
