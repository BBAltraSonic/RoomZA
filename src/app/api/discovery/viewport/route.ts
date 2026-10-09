import { readDiscoveryViewport } from "@/features/discovery/viewport-data";
import { parseViewportBbox, viewportQuerySchema } from "@/features/discovery/viewport-contract";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const allowed = ["category", "bbox", "q", "sort", "serviceType"];
  if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)) return Response.json({ error: "Invalid map query." }, { status: 400, headers });
  const query = viewportQuerySchema.safeParse({
    category: params.get("category"), bounds: parseViewportBbox(params.get("bbox")), q: params.get("q") ?? "",
    sort: params.get("sort") ?? (params.get("category") === "service" ? "Latest" : "Ending soon"), serviceType: params.get("serviceType") ?? "All services",
  });
  if (!query.success) return Response.json({ error: "Invalid map query." }, { status: 400, headers });
  try { return Response.json(await readDiscoveryViewport(query.data, request.signal), { headers }); }
  catch { return Response.json({ error: "Visible listings could not be loaded. Try again." }, { status: 503, headers }); }
}
