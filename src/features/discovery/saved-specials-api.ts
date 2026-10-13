import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { publicLiveOfferSchema } from "@/features/offers/public-contract";
import { publicEntrySchema } from "@/features/entries/public-contract";
import { enrichDiscoveryItems } from "./presentation-data";
export const savedSpecialTargetSchema = z.object({ category: z.enum(["shopping", "tourism", "event"]), id: z.string().uuid() }).strict();
const resultSchema = z.object({ authenticated: z.boolean(), serverNow: z.string(), targets: z.array(savedSpecialTargetSchema), items: z.array(savedSpecialTargetSchema.extend({ item: z.union([publicLiveOfferSchema, publicEntrySchema]).nullable() })) });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function readSavedSpecials(stateOnly = false) {
  const client = await createClient() as unknown as SupabaseClient;
  const { data, error } = await client.rpc("saved_specials_read", { state_only: stateOnly }); if (error) throw error;
  const result = resultSchema.parse(data);
  if (!stateOnly) {
    const available = result.items.flatMap(value => value.item ? [value.item] : []);
    const enriched = await enrichDiscoveryItems(available);
    const byTarget = new Map(enriched.map(item => [("offerId" in item ? "shopping:" + item.offerId : item.category + ":" + item.entryId), item]));
    result.items = result.items.map(value => ({ ...value, item: value.item ? byTarget.get(value.category + ":" + value.id) ?? value.item : null }));
  }
  return result;
}
export async function handleSavedSpecials(request: Request) {
  try {
    if (request.method === "GET") return json(await readSavedSpecials(new URL(request.url).searchParams.get("stateOnly") === "1"));
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Same-origin request required." }, 403);
    const target = savedSpecialTargetSchema.parse(await request.json());
    const client = await createClient() as unknown as SupabaseClient;
    const { data: { user } } = await client.auth.getUser(); if (!user || user.is_anonymous) return json({ error: "Sign in to save Specials." }, 401);
    const { data, error } = await client.rpc("saved_specials_write", { category: target.category, target: target.id, save: request.method === "POST" }); if (error) throw error;
    return json(z.object({ saved: z.boolean(), savedCount: z.number().int().nonnegative() }).parse(data));
  } catch (error) { return json({ error: error instanceof z.ZodError ? "Invalid Special." : "Saved Specials could not be updated." }, error instanceof z.ZodError ? 422 : 503); }
}
