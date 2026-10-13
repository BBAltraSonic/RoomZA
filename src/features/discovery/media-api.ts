import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createUntypedClient } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/features/listings/types";
import { signedPrivateMedia } from "./presentation-data";
const categorySchema = z.enum(["shopping", "tourism", "event", "service"]);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function handleDiscoveryMedia(request: Request) {
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Same-origin request required." }, 403);
  const client = await createClient() as unknown as SupabaseClient;
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous) return json({ error: "Sign in to manage photos." }, 401);
  try {
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const category = categorySchema.parse(params.get("category")), target = z.string().uuid().parse(params.get("target"));
      const { data, error } = await client.rpc("discovery_media_list", { category, target }); if (error) throw error;
      const media = z.array(z.object({ id: z.string().uuid(), path: z.string() })).parse(data);
      return json({ media: await signedPrivateMedia(client, media) });
    }
    if (request.method === "DELETE") {
      const body = z.object({ category: categorySchema, target: z.string().uuid(), media: z.string().uuid() }).strict().parse(await request.json());
      const { data, error } = await client.rpc("discovery_media_manage", { ...body, command: "delete" }); if (error) throw error;
      const { error: storageError } = await createUntypedClient().storage.from("discovery-media").remove([data.path]);
      if (storageError) throw storageError;
      return json({ deleted: true });
    }
    if (Number(request.headers.get("content-length")) > 10485760 + 65536) return json({ error: "Choose one photo up to 10 MB." }, 413);
    const form = await request.formData();
    const category = categorySchema.parse(form.get("category")), target = z.string().uuid().parse(form.get("target")), expected_version = z.coerce.number().int().positive().parse(form.get("expectedVersion"));
    const file = form.get("file"); if (!(file instanceof File)) return json({ error: "Choose a photo." }, 422);
    const valid = validateImageUpload(file.type, file.size); if (!valid.valid) return json({ error: valid.error }, 422);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : file.type === "image/png" ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) : new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP";
    if (!signature) return json({ error: "The file does not match its image format." }, 422);
    const { data, error } = await client.rpc("discovery_media_manage", { command: "reserve", category, target, expected_version, mime: file.type, bytes: file.size }); if (error) throw error;
    try {
      const upload = await client.storage.from("discovery-media").upload(data.path, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error;
      const complete = await client.rpc("discovery_media_manage", { command: "complete", category, target, media: data.id }); if (complete.error) throw complete.error;
      return json({ media: (await signedPrivateMedia(client, [{ id: data.id, path: data.path }]))[0] }, 201);
    } catch (error) {
      const cleanup = await client.rpc("discovery_media_manage", { command: "delete", category, target, media: data.id });
      if (!cleanup.error) await createUntypedClient().storage.from("discovery-media").remove([data.path]);
      throw error;
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    return json({ error: code === "PT409" ? "This draft changed. Load the latest version before uploading." : code === "42501" ? "Photo access is unavailable." : error instanceof z.ZodError ? "Check the photo request." : "Photo operation failed. Keep your draft and retry." }, code === "PT409" ? 409 : code === "42501" ? 403 : 422);
  }
}
