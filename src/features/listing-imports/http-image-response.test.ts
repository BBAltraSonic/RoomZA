import { expect, it } from "vitest";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { decodeImageHttpBody, readImageHttpResponse } from "./http-image-response";

function socket(source: string | Uint8Array, split = 7) {
  const bytes = typeof source === "string" ? new TextEncoder().encode(source) : source; let offset = 0;
  return { async read(target: Uint8Array) { if (offset === bytes.length) return null; const length = Math.min(split, target.length, bytes.length - offset); target.set(bytes.subarray(offset, offset + length)); offset += length; return length; }, get consumed() { return offset; } };
}
it("reads a split fixed-length response without waiting for the peer to close", async () => {
  const peer = socket("HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nabc");
  const response = await readImageHttpResponse(peer, 50);
  expect(new TextDecoder().decode(response.bytes)).toBe("abc");
});
it("reads interim responses, chunk extensions and trailers across byte boundaries", async () => {
  const response = await readImageHttpResponse(socket("HTTP/1.1 103 Early Hints\r\nLink: </a>\r\n\r\nHTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2;a=b\r\nab\r\n1\r\nc\r\n0\r\nDigest: fixture\r\n\r\n", 1), 50);
  expect(new TextDecoder().decode(response.bytes)).toBe("abc");
});
it("does not read a redirect body before the caller validates its destination", async () => {
  const peer = socket("HTTP/1.1 302 Found\r\nLocation: https://127.0.0.1/private\r\n\r\n", 1);
  const response = await readImageHttpResponse(peer, 50);
  expect(response.status).toBe(302); expect(response.bytes.length).toBe(0); expect(response.headers.get("location")).toContain("127.0.0.1");
});
it.each([
  "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nContent-Length: 3\r\n\r\nabc",
  "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nTransfer-Encoding: chunked\r\n\r\n",
  "HTTP/1.1 200 OK\r\nContent-Length: 51\r\n\r\n",
  "HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\na",
  "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nzz\r\n",
  "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n1\r\na!!",
  "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n33\r\n",
  "HTTP/1.1 200 OK\n\nabc",
  "HTTP/1.1 101 Switching Protocols\r\n\r\n",
  "HTTP/1.1 200 OK\r\nBad Header: value\r\n\r\n",
  "HTTP/1.1 200 OK\r\nX-Large: " + "x".repeat(17000) + "\r\n\r\n",
])("refuses malformed, ambiguous, truncated or oversized framing (%#)", async input => {
  await expect(readImageHttpResponse(socket(input), 50)).rejects.toThrow();
});
it("supports bounded connection-close framing", async () => {
  const response = await readImageHttpResponse(socket("HTTP/1.0 200 OK\r\n\r\nabc"), 50);
  expect(new TextDecoder().decode(response.bytes)).toBe("abc");
});
it.each([["gzip", gzipSync], ["deflate", deflateSync], ["br", brotliCompressSync]] as const)("decodes %s and stops a decompression bomb", async (encoding, compress) => {
  const original = new TextEncoder().encode("fixture");
  expect(await decodeImageHttpBody(compress(original), encoding, 50)).toEqual(original);
  await expect(decodeImageHttpBody(compress(new Uint8Array(10000)), encoding, 50)).rejects.toThrow("10 MB");
});
it("refuses unsupported and excessive compression stacks", async () => {
  await expect(decodeImageHttpBody(new Uint8Array(), "unknown", 50)).rejects.toThrow();
  await expect(decodeImageHttpBody(new Uint8Array(), "gzip,gzip,gzip,gzip", 50)).rejects.toThrow();
});
