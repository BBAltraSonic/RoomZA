/**
 * Stand-in for `@supabase/ssr` while server-rendering client components.
 *
 * Client components build the browser client during render (often in `useMemo`)
 * but only call it from effects and event handlers, which never run on the
 * server. Bundling the real package there added a full copy of supabase-js to
 * the Cloudflare Worker, so `next.config.ts` aliases it to this file for the
 * SSR layer only. The client can be created; touching it on the server throws.
 */

const SERVER_RENDER_ERROR = "The Supabase browser client cannot be used while server-rendering. Use it from an effect or event handler.";

function unavailableOnServer(): never {
  throw new Error(SERVER_RENDER_ERROR);
}

const serverRenderClient: unknown = new Proxy({}, {
  get(_target, property) {
    // Let React, Promise resolution and dev tooling inspect the value safely.
    if (property === "then" || typeof property === "symbol") return undefined;
    return unavailableOnServer();
  },
});

export function createBrowserClient<T = unknown>(...args: unknown[]): T {
  void args; // Same call shape as the real package.
  return serverRenderClient as T;
}

export function createServerClient(...args: unknown[]): never {
  void args;
  return unavailableOnServer();
}
