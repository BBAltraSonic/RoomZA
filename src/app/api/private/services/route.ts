import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { safeRedirectPath } from "@/lib/redirects";
import { writeService } from "@/features/services/data";
import { serviceDraftSchema } from "@/features/services/schema";
const command = z
  .object({
    command: z.enum(["create", "save", "submit", "withdraw"]),
    id: z.string().uuid(),
    expectedVersion: z.number().int().min(0).max(2147483646),
    draft: serviceDraftSchema.optional(),
    permissionConfirmed: z.boolean().optional(),
  })
  .strict();
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "This request must come from this site." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Send JSON." }, { status: 415 });
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 20000)
      return Response.json(
        { error: "Service submission is too long." },
        { status: 413 },
      );
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: "Invalid JSON." }, { status: 400 });
    }
    return Response.json(await writeService(command.parse(body)), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (isRedirectError(error))
      return Response.json(
        {
          error: "Your account needs attention before continuing.",
          nextPath: safeRedirectPath(
            getURLFromRedirectError(error),
            "/post/services",
          ),
        },
        { status: 401 },
      );
    if (error instanceof z.ZodError)
      return Response.json(
        { error: "Check the fields and try again." },
        { status: 400 },
      );
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    return Response.json(
      {
        error:
          code === "PT409"
            ? "This service changed. Reload the latest version; your unsaved text is still here."
            : code === "42501"
              ? "You do not have access to this service."
              : code === "22023"
                ? "Complete the required fields or withdraw the pending submission first."
                : "Could not save. Your text is still here.",
      },
      {
        status:
          code === "PT409"
            ? 409
            : code === "42501"
              ? 403
              : code === "22023"
                ? 400
                : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
