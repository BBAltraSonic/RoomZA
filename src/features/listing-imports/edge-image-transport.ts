import "server-only";

/** Uses the existing project's free Edge runtime for a checked, TLS-pinned hop. */
export async function fetchPinnedEdgeImage(url: URL, addresses: string[], signal: AbortSignal) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !key) throw new Error("The secure image download service is unavailable. Try again later.");
  const endpoint = new URL("/functions/v1/import-image", projectUrl);
  const response = await fetch(endpoint, {
    method: "POST", redirect: "manual", cache: "no-store", signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ url: url.toString(), addresses }),
  });
  if (response.headers.get("x-roomza-image-transport") !== "pinned-tls-v1") {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("The secure image download service is unavailable. Try again later.");
  }
  return response;
}
