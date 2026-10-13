import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { searchLocationCatalogue } from "@/features/places/catalogue";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  await requireUser({ redirectTo: "/post/offers" });
  const params = new URL(request.url).searchParams;
  const query = z.string().trim().min(2).max(100).safeParse(params.get("q"));
  if (!query.success || params.getAll("q").length !== 1 || [...params.keys()].some(key => key !== "q")) return Response.json({ error: "Enter two to one hundred characters." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const headers = { "Cache-Control": "private, no-store" };
  const limit = await consumeRateLimit({ key: `private-places:${getClientIp(request)}`, requests: 60, window: "1 m" });
  if (!limit.success) return Response.json({ error: "Too many searches. Try again shortly." }, { status: 429, headers });
  try { return Response.json(await searchLocationCatalogue(query.data), { headers }); }
  catch { return Response.json({ error: "Could not load locations. Try again." }, { status: 503, headers }); }
}
