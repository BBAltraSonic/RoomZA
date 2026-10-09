import "server-only";
import { z } from "zod";
import { readPublicOffer, readPublicOfferAction, readPublicOfferCount, readPublicOfferFeed } from "./public-data";
import { publicOfferCursorSchema } from "./public-contract";

const headers = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const uuid = z.string().uuid();
function query(request: Request, allowed: readonly string[]) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) return null;
  }
  return params;
}
const unavailable = () => json({ error: "Shopping Offers could not be loaded. Try again." }, 503);

export async function handlePublicOfferFeed(request: Request, countOnly = false) {
  const params = query(request, countOnly ? ["areaId"] : ["areaId", "afterConfirmedAt", "afterOfferId"]);
  const area = uuid.safeParse(params?.get("areaId"));
  if (!params || !area.success) return json({ error: "Select a stored place to load Shopping Offers." }, 400);
  const hasCursor = params.has("afterConfirmedAt") || params.has("afterOfferId");
  const cursor = hasCursor ? publicOfferCursorSchema.safeParse({ confirmedAt: params.get("afterConfirmedAt"), offerId: params.get("afterOfferId") }) : null;
  if (cursor && !cursor.success) return json({ error: "The offer page cursor is invalid." }, 400);
  try {
    return json(countOnly ? await readPublicOfferCount(area.data) : await readPublicOfferFeed(area.data, cursor?.data));
  } catch { return unavailable(); }
}
export async function handlePublicOfferDetail(request: Request, offerId: string) {
  if (!uuid.safeParse(offerId).success || !query(request, [])) return json({ error: "Invalid offer link." }, 400);
  try {
    const offer = await readPublicOffer(offerId);
    return json(offer, offer.status === "unavailable" ? 404 : offer.status === "expired" ? 410 : 200);
  } catch { return unavailable(); }
}
export async function handlePublicOfferDirections(request: Request, offerId: string) {
  if (!uuid.safeParse(offerId).success || !query(request, [])) return json({ error: "Invalid offer link." }, 400);
  const started = performance.now();
  try {
    const offer = await readPublicOfferAction(offerId);
    if (!offer) return json({ error: "This offer is no longer available for directions." }, 410);
    // Subtract the entire RPC span from the DB-reported remaining time. That is
    // conservative even when app and DB wall clocks differ or the reply is slow.
    const remaining = Date.parse(offer.endsAt) - Date.parse(offer.serverNow);
    if (remaining <= Math.ceil(performance.now() - started)) return json({ error: "This offer has ended. Reload to find current offers." }, 410);
    const destination = new URL("https://www.google.com/maps/dir/");
    destination.searchParams.set("api", "1");
    destination.searchParams.set("destination", `${offer.latitude},${offer.longitude}`);
    if (request.headers.get("accept")?.includes("application/json")) {
      return json({ destination: destination.href, serverNow: offer.serverNow, endsAt: offer.endsAt });
    }
    return new Response(null, { status: 302, headers: { ...headers, Location: destination.href } });
  } catch { return unavailable(); }
}
