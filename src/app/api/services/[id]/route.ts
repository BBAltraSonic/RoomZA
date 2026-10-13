import { z } from "zod";
import { readPublicService } from "@/features/services/data";
import { serviceDetailSchema } from "@/features/services/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  const headers = { "Cache-Control": "no-store" };
  if (!id.success) return Response.json({ error: "Invalid service link." }, { status: 400, headers });
  try {
    const result = serviceDetailSchema.parse({ item: await readPublicService(id.data) });
    return Response.json(result, { status: result.item ? 200 : 404, headers });
  } catch {
    return Response.json({ error: "Service details could not be loaded." }, { status: 503, headers });
  }
}
