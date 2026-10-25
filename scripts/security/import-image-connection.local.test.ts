/* eslint-disable @typescript-eslint/no-unsafe-function-type -- This native connection probe wraps overloaded DNS and socket functions without replacing their runtime behavior. */
import fs from "node:fs";
import dns from "node:dns";
import net from "node:net";
import https from "node:https";
import type { TLSSocket } from "node:tls";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
const answers = vi.hoisted(() => ({ resolve4: vi.fn(async () => ["8.8.8.8"]), resolve6: vi.fn(async () => []) }));
vi.mock("node:dns/promises", () => answers);
import { fetchSafeImage } from "../../src/features/listing-imports/safe-image-url";
import { fetchPinnedNodeImage } from "../../src/features/listing-imports/node-image-transport";
import { IMPORT_LIMITS } from "../../src/features/listing-imports/limits";

const enabled = process.env.PINPOINT_IMAGE_CONNECTION_PROBE === "1";
const run = enabled ? it : it.skip;
const hostname = "images.pinpoint.invalid";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZP0AAAAASUVORK5CYII=", "base64");
const requests: Array<{host?:string;path?:string;remote?:string;servername?:string|false|null}> = [], resolved: string[] = [];
const closedPaths = new Set<string>();
let server: https.Server;
beforeAll(async () => {
  if (!enabled) return;
  const cert = process.env.NODE_EXTRA_CA_CERTS, key = process.env.PINPOINT_IMAGE_FIXTURE_KEY;
  if (!cert || !key) throw Error("Explicit process-scoped fixture credentials required");
  server = https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, (request, response) => {
    requests.push({ host: request.headers.host, path: request.url, remote: request.socket.remoteAddress, servername: (request.socket as TLSSocket).servername });
    response.once("close",()=>closedPaths.add(request.url!));
    if(request.url==='/redirect'){response.writeHead(302,{location:'https://127.0.0.1/private-image.png'});response.end();return;}
    if(request.url==='/slow'){response.writeHead(200,{'content-type':'image/png'});response.flushHeaders();return;}
    if(request.url==='/declared-limit'){response.writeHead(200,{'content-length':String(IMPORT_LIMITS.imageBytes+1)});response.end();return;}
    if(request.url==='/chunked-limit'){response.writeHead(200,{'content-type':'image/png'});response.end(Buffer.alloc(IMPORT_LIMITS.imageBytes+1));return;}
    if(request.url==='/gzip'){const zipped=gzipSync(png);response.writeHead(200,{'content-type':'image/png','content-encoding':'gzip','content-length':String(zipped.length)});response.end(zipped);return;}
    if(request.url==='/cancel'){response.writeHead(200,{'content-type':'image/png'});response.write(png);return;}
    response.writeHead(200, { "content-type": "image/png", "content-length": String(png.length), connection: "close" }); response.end(png);
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(443, "127.0.0.1", resolve); });
});

// Transport-only fixtures intentionally dial owned loopback directly. Production
// callers reach this internal helper only after public-address policy validation.
const localResponse=(path:string,signal=AbortSignal.timeout(2000))=>fetchPinnedNodeImage(new URL(`https://${hostname}${path}`),['127.0.0.1'],signal);
run('preserves actual TLS identity, Host, encoded path/query and exact image bytes',async()=>{
 const response=await localResponse('/cover.png?source=%2Fcover&v=1');expect(response.status).toBe(200);expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
 expect(requests.at(-1)).toMatchObject({host:hostname,path:'/cover.png?source=%2Fcover&v=1',servername:hostname});
});
run('rejects a mismatched certificate name before sending any HTTP request',async()=>{
 const count=requests.length;await expect(fetchPinnedNodeImage(new URL('https://wrong.pinpoint.invalid/cover.png'),['127.0.0.1'],AbortSignal.timeout(2000))).rejects.toMatchObject({code:'ERR_TLS_CERT_ALTNAME_INVALID'});expect(requests).toHaveLength(count);
});
run('rejects an untrusted certificate without changing process or system trust',async()=>{
 const cert=process.env.PINPOINT_IMAGE_UNTRUSTED_CERT!,key=process.env.PINPOINT_IMAGE_UNTRUSTED_KEY!,count=requests.length;
 server.setSecureContext({cert:fs.readFileSync(cert),key:fs.readFileSync(key)});
 try{await expect(localResponse('/untrusted')).rejects.toMatchObject({code:'DEPTH_ZERO_SELF_SIGNED_CERT'});expect(requests).toHaveLength(count);}
 finally{server.setSecureContext({cert:fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS!),key:fs.readFileSync(process.env.PINPOINT_IMAGE_FIXTURE_KEY!)});}
});
run('preserves valid compressed image responses through bounded native decoding',async()=>{
 const response=await localResponse('/gzip');expect(response.headers.has('content-encoding')).toBe(false);expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
});
run('returns a redirect for policy validation without following its target',async()=>{
 const count=requests.length,response=await localResponse('/redirect');expect(response.status).toBe(302);expect(response.headers.get('location')).toBe('https://127.0.0.1/private-image.png');expect(response.body).toBeNull();expect(requests).toHaveLength(count+1);
});
run('refuses a literal URL whose supplied connection address does not match',async()=>{
 await expect(async()=>fetchPinnedNodeImage(new URL('https://127.0.0.1/private-image.png'),['8.8.8.8'],AbortSignal.timeout(1000))).rejects.toThrow(/address changed/);
});
run('closes native responses whose declared or streamed bytes exceed the image limit',async()=>{
 await expect(localResponse('/declared-limit')).rejects.toThrow(/10 MB/);const response=await localResponse('/chunked-limit');await expect(response.arrayBuffer()).rejects.toThrow(/10 MB/);
});
run('carries the absolute request deadline through a stalled response body',async()=>{
 const response=await localResponse('/slow',AbortSignal.timeout(80));await expect(response.arrayBuffer()).rejects.toThrow(/aborted|timeout/i);
});
run('cancelling a native response body closes its owned TLS connection',async()=>{
 const response=await localResponse('/cancel');const reader=response.body!.getReader();expect((await reader.read()).value?.length).toBe(png.length);await reader.cancel();
 for(let attempt=0;attempt<100&&!closedPaths.has('/cancel');attempt++)await new Promise(resolve=>setTimeout(resolve,10));expect(closedPaths.has('/cancel')).toBe(true);
});
run('downloads an actual public PNG through the complete checked and pinned Node path',async()=>{
 const addresses=JSON.parse(process.env.PINPOINT_IMAGE_PUBLIC_ADDRESSES??'[]') as string[];expect(addresses.length).toBeGreaterThan(0);
 answers.resolve4.mockResolvedValue(addresses);const image=await fetchSafeImage('https://www.gstatic.com/webp/gallery3/1.png');expect(image.mimeType).toBe('image/png');expect(image.bytes.length).toBeGreaterThan(68);expect(image.finalUrl.hostname).toBe('www.gstatic.com');
 if(process.env.PINPOINT_IMAGE_PUBLIC_RESULT)fs.writeFileSync(process.env.PINPOINT_IMAGE_PUBLIC_RESULT,JSON.stringify({at:new Date().toISOString(),checkedAddresses:addresses,bytes:image.bytes.length,mimeType:image.mimeType,scope:'Actual public HTTPS image; checked DNS answers supplied from parent OS lookup because native resolve4 is unavailable locally. Native pinned connection and certificate validation; no hosted/Workers claim.'},null,2));
});
afterAll(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

run("keeps native image HTTPS on the checked DNS addresses and refuses a changed connection resolver", async () => {
  answers.resolve4.mockReset().mockResolvedValue(["8.8.8.8"]); answers.resolve6.mockReset().mockResolvedValue([]);
  const requestStart = requests.length;
  const originalLookup = dns.lookup, originalConnect = net.Socket.prototype.connect, nativeFetch = globalThis.fetch;
  let outcome: { accepted: boolean; bytes?: number; error?: string };
  dns.lookup = ((host: string, options: unknown, callback?: unknown) => {
    if (host !== hostname) return (originalLookup as Function)(host, options, callback);
    const done = (typeof options === "function" ? options : callback) as Function;
    queueMicrotask(() => typeof options === "object" && options !== null && "all" in options && options.all
      ? done(null, [{ address: "127.0.0.1", family: 4 }]) : done(null, "127.0.0.1", 4));
  }) as typeof dns.lookup;
  // Native Socket.connect still executes its real lookup path. Only a validated
  // 8.8.8.8 dial is stopped before TCP, so this probe cannot contact that public IP.
  // An unsafe lookup to owned loopback is allowed to reach the actual TLS server.
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    const options = (Array.isArray(args[0]) ? args[0][0] : args[0]) as { host?: string; lookup?: Function } | undefined;
    if (options?.host === hostname) {
      const lookup = options.lookup ?? dns.lookup;
      options.lookup = (host: string, lookupOptions: unknown, callback: Function) => lookup(host, lookupOptions, (error: Error | null, address: string | Array<{ address: string; family: number }>, family?: number) => {
        const addresses = typeof address === "string" ? [address] : address?.map(item => item.address) ?? [];
        resolved.push(...addresses);
        if (addresses.includes("8.8.8.8")) return callback(new Error("Owned probe stops the approved public dial before TCP"));
        return callback(error, address, family);
      });
    }
    return (originalConnect as Function).apply(this, args);
  } as typeof net.Socket.prototype.connect;
  try {
    try { const image = await fetchSafeImage(`https://${hostname}/cover.png`); outcome = { accepted: true, bytes: image.bytes.length }; }
    catch (error) { outcome = { accepted: false, error: error instanceof Error ? error.message : String(error) }; }
    const privateRequests = requests.slice(requestStart);
    const report = { at: new Date().toISOString(), outcome, resolved, privateRequests, globalFetchUnchanged: globalThis.fetch === nativeFetch,
      scope: "Real Node HTTPS and native connection resolver path. Declared public check; process-local adversarial connection DNS; approved public dial stopped before TCP. Only owned loopback TLS fixture contacted; fixture CA trusted only by this child process. Not Workers proof." };
    if (process.env.PINPOINT_IMAGE_PROBE_RESULT) fs.writeFileSync(process.env.PINPOINT_IMAGE_PROBE_RESULT, JSON.stringify(report, null, 2));
    expect(globalThis.fetch).toBe(nativeFetch);
    expect(privateRequests, "No connection may reach the unvalidated owned loopback target").toHaveLength(0);
    expect(outcome.accepted).toBe(false); expect(resolved).toContain("8.8.8.8");
  } finally { dns.lookup = originalLookup; net.Socket.prototype.connect = originalConnect; }
});

