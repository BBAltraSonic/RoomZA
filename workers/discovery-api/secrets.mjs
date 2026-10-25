import { requestContext } from "./request-context.mjs";

// esbuild injects this into static server credential accesses. No process-wide
// environment mutation: concurrent callers cannot share credentials or sessions.
export const __discoverySecrets = new Proxy({}, {
  get(_target, key) { return requestContext().credentials[key]; },
});

export function internalCredentials(request) {
  const value = request.headers.get("authorization") ?? "";
  if (!value.startsWith("RoomzaInternal ")) return null;
  try {
    const parsed = JSON.parse(atob(value.slice("RoomzaInternal ".length)));
    const result = {};
    for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
      if (typeof parsed[key] === "string") result[key] = parsed[key];
    }
    return result;
  } catch { return null; }
}
