import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const idsSchema = z.array(z.string().uuid()).max(250);
const headers = { "Cache-Control": "no-store" };

/** Which of the given services are inside their booking hours right now (Services "Open now" quick filter). */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = idsSchema.safeParse([...new Set(raw.split(",").filter(Boolean))]);
  if (!ids.success) return Response.json({ error: "Invalid services." }, { status: 400, headers });
  if (!ids.data.length) return Response.json({ openIds: [] }, { headers });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("services_open_now", { service_ids: ids.data });
  // A failed check must say so; an empty list would read as "nothing is open".
  if (error || !Array.isArray(data)) return Response.json({ error: "Opening hours could not be checked." }, { status: 503, headers });
  return Response.json({ openIds: data }, { headers });
}
