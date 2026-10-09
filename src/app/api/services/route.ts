import { z } from "zod";
import { readServiceFeed } from "@/features/services/data";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const area = z.string().uuid().safeParse(params.get("areaId"));
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(params.get("page") ?? 1);
  if (!area.success || !page.success)
    return Response.json(
      { error: "Choose a valid location and page." },
      { status: 400 },
    );
  try {
    return Response.json(await readServiceFeed(area.data, page.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Services could not be loaded." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
