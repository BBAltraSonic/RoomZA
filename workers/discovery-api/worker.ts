import { GET as listings } from "../../src/app/api/listings/route";
import { GET as viewport } from "../../src/app/api/discovery/viewport/route";
import { GET as savedSpecials } from "../../src/app/api/saved-specials/route";
import { GET as favorites } from "../../src/app/api/favorites/route";
import { GET as notifications } from "../../src/app/api/notifications/route";
import { createClient } from "./supabase-server";
import { withRequestContext } from "./request-context.mjs";
import { isDiscoveryApiRequest } from "../../cloudflare/discovery-api-routing.mjs";
import { internalCredentials } from "./secrets.mjs";

const handlers: Record<string, (request: Request) => Promise<Response> | Response> = {
  "/api/listings": listings,
  "/api/discovery/viewport": viewport,
  "/api/saved-specials": savedSpecials,
  "/api/favorites": favorites,
  "/api/notifications": notifications,
};

export async function accountGuard(request: Request) {
  const client = await createClient();
  // Preserve the app middleware's verified-session refresh and suspension gate.
  let user;
  try { user = (await client.auth.getUser()).data.user; }
  catch { return null; }
  if (user) {
    const { data: active } = await client.rpc("is_current_account_active" as never);
    if (active === false) return Response.json({ ok: false, error: {
      code: "account_suspended", message: "Account access is suspended.",
    }, requestId: request.headers.get("x-request-id") }, { status: 403, headers: { "cache-control": "private, no-store" } });
  }
  return null;
}

const worker = {
  async fetch(request: Request) {
    if (!isDiscoveryApiRequest(request)) return new Response("Not found", { status: 404 });
    const credentials = internalCredentials(request);
    if (!credentials) return new Response("Internal service only", { status: 403 });
    const headers = new Headers(request.headers);
    headers.set("x-request-id", headers.get("x-request-id") ?? crypto.randomUUID());
    const scoped = new Request(request, { headers });
    return withRequestContext(scoped, async () => {
      try {
        const response = await accountGuard(scoped) ?? await handlers[new URL(scoped.url).pathname]!(scoped);
        response.headers.set("x-request-id", headers.get("x-request-id")!);
        return response;
      } catch {
        return Response.json({ ok: false, error: { code: "service_unavailable", message: "Unable to load results. Try again." } }, {
          status: 503, headers: { "cache-control": "private, no-store", "x-request-id": headers.get("x-request-id")! },
        });
      }
    }, credentials);
  },
};
export default worker;
