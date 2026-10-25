import { timingSafeEqual } from "node:crypto";
import { servePinnedImageHop } from "../../src/features/listing-imports/pinned-image-service";

const encoder = new TextEncoder();
Deno.serve(async request => {
  const supplied = request.headers.get("authorization") ?? "";
  const approved = Deno.env.get("IMPORT_IMAGE_CALLER_SHA256") ?? "";
  const suppliedHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(supplied)));
  const expectedHash = /^[0-9a-f]{64}$/.test(approved) ? Uint8Array.from(approved.match(/../g)!, byte => Number.parseInt(byte, 16)) : new Uint8Array();
  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) return new Response("Access denied", { status: 403 });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return new Response("Expected JSON", { status: 415 });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(19000)]);
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error("Invalid image request");
    const chunks: Uint8Array[] = []; let length = 0;
    const cancelRead = () => { void reader.cancel().catch(() => undefined); };
    signal.throwIfAborted(); signal.addEventListener("abort", cancelRead, { once: true });
    try {
      for (;;) { const { value, done } = await reader.read(); signal.throwIfAborted(); if (done) break; length += value.length; if (length > 16384) throw new Error("Image request too large"); chunks.push(value); }
    } finally { signal.removeEventListener("abort", cancelRead); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const input: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return await servePinnedImageHop(input, signal, async (address, identity, deadline) => {
      let raw: Deno.TcpConn | undefined, secure: Deno.TlsConn | undefined;
      const close = () => { try { (secure ?? raw)?.close(); } catch { /* Already closed. */ } };
      let rejectDeadline: (reason: unknown) => void = () => undefined;
      const aborted = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
      const cancel = () => { close(); rejectDeadline(deadline.reason); };
      deadline.throwIfAborted(); deadline.addEventListener("abort", cancel, { once: true });
      try {
        // Cancellation also closes a connection that arrives after its deadline.
        raw = await Promise.race([Deno.connect({ hostname: address, port: 443 }).then(connection => {
          raw = connection; if (deadline.aborted) close(); return connection;
        }), aborted]);
        deadline.throwIfAborted();
        if (raw.remoteAddr.hostname !== address) throw new Error("Image destination changed");
        secure = await Promise.race([Deno.startTls(raw, { hostname: identity, alpnProtocols: ["http/1.1"] }).then(connection => {
          secure = connection; if (deadline.aborted) close(); return connection;
        }), aborted]);
        await Promise.race([secure.handshake(), aborted]); deadline.throwIfAborted();
        const connected = secure;
        return { read: (buffer: Uint8Array) => connected.read(buffer), write: (buffer: Uint8Array) => connected.write(buffer), close: () => { deadline.removeEventListener("abort", cancel); close(); } };
      } catch (error) { deadline.removeEventListener("abort", cancel); close(); throw error; }
    });
  } catch {
    // Neither credentials nor user-supplied URLs are logged or returned.
    return new Response("The image could not be downloaded safely.", { status: 502, headers: { "x-roomza-image-transport": "pinned-tls-v1", "cache-control": "private, no-store" } });
  }
});
