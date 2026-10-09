import { z } from "zod";
import { searchOfferDiscoveryPlaces } from "@/features/offers/public-place-data";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  const params = new URL(request.url).searchParams;
  const query = z.string().trim().min(2).max(100).safeParse(params.get("q"));
  if ([...params.keys()].some((key) => key !== "q") || params.getAll("q").length !== 1 || !query.success) {
    return Response.json({ error: "Enter between two and one hundred letters to search locations." }, { status: 400, headers });
  }
  try { return Response.json(await searchOfferDiscoveryPlaces(query.data), { headers }); }
  catch { return Response.json({ error: "Could not load locations. Try again." }, { status: 503, headers }); }
}
