import { AsyncLocalStorage } from "node:async_hooks";
import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

const requests = new AsyncLocalStorage();
export function requestContext() {
  const context = requests.getStore();
  if (!context) throw new Error("Discovery API requires a request context.");
  return context;
}

export function withRequestContext(request, callback, credentials = {}) {
  const context = {
    request,
    cookies: new Map(parseCookieHeader(request.headers.get("cookie") ?? "").map(({ name, value }) => [name, value ?? ""])),
    outgoingCookies: new Map(),
    client: null,
    credentials,
  };
  return requests.run(context, async () => {
    const response = await callback();
    const headers = new Headers(response.headers);
    for (const value of context.outgoingCookies.values()) headers.append("set-cookie", value);
    // Session rotation makes even otherwise public data unsafe to cache.
    if (context.outgoingCookies.size) headers.set("cache-control", "private, no-store");
    headers.set("x-roomza-api", "discovery-worker");
    return new Response(response.body, { status: response.status, headers });
  });
}

export function setCookies(cookies) {
  const context = requestContext();
  for (const { name, value, options } of cookies) {
    context.cookies.set(name, value);
    context.outgoingCookies.set(name, serializeCookieHeader(name, value, { path: "/", ...options }));
  }
}
