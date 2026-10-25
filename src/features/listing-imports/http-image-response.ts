import { Readable, PassThrough, pipeline } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export type ImageSocketReader = { read(buffer: Uint8Array): Promise<number | null> };

/** Bounded HTTP/1 framing for a single GET on an already authenticated TLS socket. */
export async function readImageHttpResponse(socket: ImageSocketReader, limit: number) {
  const buffer = new Uint8Array(16_384);
  let offset = 0, available = 0, wireBytes = 0;
  let headerBytes = 0;
  async function fill() {
    if (offset < available) return true;
    available = await socket.read(buffer) ?? 0; offset = 0;
    wireBytes += available;
    if (wireBytes > limit + 2 * 1024 * 1024) throw new Error("Image response framing exceeds the safe limit.");
    return available > 0;
  }
  async function byte() {
    if (!await fill()) throw new Error("The image response ended early.");
    return buffer[offset++]!;
  }
  async function line(max: number, header = false) {
    const bytes: number[] = [];
    for (;;) {
      const value = await byte();
      if (header && ++headerBytes > 16_384) throw new Error("The image response headers are too large.");
      if (value === 10) {
        if (bytes.pop() !== 13) throw new Error("The image response has invalid line endings.");
        return new TextDecoder().decode(Uint8Array.from(bytes));
      }
      bytes.push(value);
      if (bytes.length > max) throw new Error("The image response line is too large.");
    }
  }
  const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
  async function headers() {
    const result = new Headers(); let count = 0;
    for (;;) {
      const value = await line(16_384, true); if (!value) return result;
      const colon = value.indexOf(":");
      const name = value.slice(0, colon);
      if (colon < 1 || !token.test(name) || /[\x00-\x08\x0b-\x1f\x7f]/.test(value) || ++count > 128) throw new Error("The image response headers are invalid.");
      if (name.toLowerCase() === "content-length" && result.has(name)) throw new Error("The image response has conflicting lengths.");
      result.append(name, value.slice(colon + 1).trim());
    }
  }
  let status = 0, responseHeaders = new Headers();
  for (let interim = 0; interim < 6; interim++) {
    const match = /^HTTP\/1\.[01] ([1-5]\d\d)(?: [^\r\n]*)?$/.exec(await line(1024, true));
    if (!match) throw new Error("The image response status is invalid.");
    status = Number(match[1]); responseHeaders = await headers();
    if (status === 101) throw new Error("Image downloads cannot upgrade the connection.");
    if (status >= 200) break;
    if (interim === 5) throw new Error("The image response has too many interim responses.");
  }
  const transfer = responseHeaders.get("transfer-encoding");
  const length = responseHeaders.get("content-length");
  if ((transfer && transfer.toLowerCase() !== "chunked") || (transfer && length !== null) || (length !== null && !/^\d+$/.test(length))) throw new Error("The image response framing is invalid.");
  if (status >= 300 || status === 204 || status === 205) return { status, headers: responseHeaders, bytes: new Uint8Array() };
  const chunks: Uint8Array[] = []; let size = 0;
  const append = (chunk: Uint8Array) => {
    size += chunk.length;
    if (size > limit) throw new Error("Images are limited to 10 MB.");
    chunks.push(chunk);
  };
  async function take(count: number) {
    if (!Number.isSafeInteger(count) || count < 0 || count + size > limit) throw new Error("Images are limited to 10 MB.");
    while (count > 0) {
      if (!await fill()) throw new Error("The image response ended early.");
      const end = Math.min(available, offset + count);
      const chunk = buffer.slice(offset, end); offset = end; count -= chunk.length; append(chunk);
    }
  }
  if (transfer) {
    for (;;) {
      const match = /^([\da-fA-F]+)(?:;[^\x00-\x1f\x7f]*)?$/.exec(await line(1024));
      if (!match) throw new Error("The image response chunk is invalid.");
      const count = Number.parseInt(match[1]!, 16);
      if (count === 0) { await headers(); break; }
      await take(count);
      if (await byte() !== 13 || await byte() !== 10) throw new Error("The image response chunk ended incorrectly.");
    }
  } else if (length !== null) await take(Number(length));
  else while (await fill()) { append(buffer.slice(offset, available)); offset = available; }
  const encoded = new Uint8Array(size); let position = 0;
  for (const chunk of chunks) { encoded.set(chunk, position); position += chunk.length; }
  return { status, headers: responseHeaders, bytes: encoded };
}

/** Both encoded and decoded bodies are bounded, including layered compression. */
export async function decodeImageHttpBody(bytes: Uint8Array, encoding: string | null, limit: number) {
  const encodings = (encoding ?? "identity").split(",").map(x => x.trim().toLowerCase()).filter(x => x !== "identity");
  if (!encodings.length) return bytes;
  if (encodings.length > 3) throw new Error("The image encoding is not supported.");
  const decoders = encodings.reverse().map(value => {
    if (value === "gzip" || value === "x-gzip") return createGunzip();
    if (value === "deflate") return createInflate();
    if (value === "br") return createBrotliDecompress();
    throw new Error("The image encoding is not supported.");
  });
  const input = Readable.from([bytes]), output = new PassThrough();
  pipeline([input, ...decoders, output], error => { if (error) output.destroy(error); });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for await (const chunk of output) {
      size += chunk.length; if (size > limit) throw new Error("Images are limited to 10 MB.");
      chunks.push(chunk);
    }
  } finally { input.destroy(); for (const decoder of decoders) decoder.destroy(); output.destroy(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
