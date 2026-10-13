import { z } from "zod";
import { searchLocationCatalogue } from "@/features/places/catalogue";
import { recentLocationIdsSchema } from "@/features/places/catalogue-contract";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  const params = new URL(request.url).searchParams;
  const query = z.string().trim().max(100).refine(value => !value || value.length >= 2).safeParse(params.get("q") ?? "");
  const recents = recentLocationIdsSchema.safeParse(params.get("recent")?.split(",").filter(Boolean) ?? []);
  if ([...params.keys()].some(key => key !== "q" && key !== "recent") || params.getAll("q").length > 1 ||
      params.getAll("recent").length > 1 || !query.success || !recents.success) {
    return Response.json({ error: "Enter a suburb, town or city using two to one hundred characters." }, { status: 400, headers });
  }
  const limit = await consumeRateLimit({ key: `location-catalogue:${getClientIp(request)}`, requests: 60, window: "1 m" });
  if (!limit.success) return Response.json({ error: "Too many searches. Try again shortly." }, { status: 429, headers });
  try {
    return Response.json(await searchLocationCatalogue(query.data, recents.data), { headers });
  } catch {
    return Response.json({ error: "Could not load locations. Try again." }, { status: 503, headers });
  }
}
