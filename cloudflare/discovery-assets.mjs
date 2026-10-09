const shells = new Map([["/", "index"], ["/offers", "offers"], ["/services", "services"]]);

export async function discoveryAssetResponse(request, env, securityHeaders) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (request.headers.has("next-action")) return null;
  const url = new URL(request.url);
  const shell = shells.get(url.pathname);
  if (!shell) return null;
  const rsc = request.headers.get("rsc") === "1";
  // Segment prefetch requires a different payload. Use a full navigation instead.
  if (rsc && request.headers.has("next-router-segment-prefetch")) return new Response(null, { status: 204 });
  url.pathname = "/__discovery/" + shell + (rsc ? ".rsc" : ".html");
  url.search = "";
  const response = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
  if (!response.ok) return null;
  const headers = new Headers(response.headers);
  for (const header of securityHeaders) headers.set(header.key, header.value);
  headers.set("content-type", rsc ? "text/x-component" : "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("vary", "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch");
  headers.set("x-roomza-render", "prerendered-discovery");
  headers.delete("set-cookie");
  return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
}
