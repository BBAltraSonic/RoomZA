// Exact read-only allowlist. Mutations and all other routes retain Next middleware.
export const discoveryApiPaths = new Set([
  "/api/listings", "/api/discovery/viewport", "/api/saved-specials",
  "/api/favorites", "/api/notifications",
]);

export function isDiscoveryApiRequest(request) {
  return request.method === "GET" && !request.headers.has("next-action") &&
    discoveryApiPaths.has(new URL(request.url).pathname);
}

export async function discoveryApiResponse(request, env, securityHeaders) {
  if (!isDiscoveryApiRequest(request) || !env.DISCOVERY_API) return null;
  // The internal service has no public URL. Forward only the existing server
  // credentials it needs, in the standard log-redacted Authorization header.
  // Always replace caller input; credentials remain request-scoped downstream.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("authorization", "RoomzaInternal " + btoa(JSON.stringify({
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  })));
  const response = await env.DISCOVERY_API.fetch(new Request(request, { headers: forwardedHeaders, redirect: "manual" }));
  const headers = new Headers(response.headers);
  for (const { key, value } of securityHeaders) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}
