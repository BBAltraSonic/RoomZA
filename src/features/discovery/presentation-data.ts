import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseEnv } from "@/lib/env";
const presentation = z.array(z.object({ id: z.string().uuid(), category: z.enum(["shopping", "tourism", "event", "service"]), savedCount: z.number().int().nonnegative(), media: z.array(z.object({ id: z.string().uuid(), path: z.string() })) }));
export type PresentationItem = { offerId?: string; entryId?: string; id?: string; category?: string; media?: { id: string; url: string }[]; savedCount?: number };
export async function enrichDiscoveryItems<T extends PresentationItem>(items: T[], category?: string): Promise<T[]> {
  if (!items.length) return items;
  if (items.length > 250) {
    const enriched: T[] = [];
    for (let offset = 0; offset < items.length; offset += 250) enriched.push(...await enrichDiscoveryItems(items.slice(offset, offset + 250), category));
    return enriched;
  }
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) } });
  const targets = items.map(item => ({ id: item.offerId ?? item.entryId ?? item.id!, category: item.offerId ? "shopping" : item.category ?? category! }));
  const { data, error } = await client.rpc("discovery_card_presentation", { targets });
  if (error) throw error;
  const results = presentation.parse(data), paths = [...new Set(results.flatMap(item => item.media.map(media => media.path)))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const signed = await client.storage.from("discovery-media").createSignedUrls(paths, 3600);
    if (signed.error) throw signed.error;
    for (const item of signed.data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return items.map((item, index) => {
    const result = results.find(value => value.id === targets[index]!.id && value.category === targets[index]!.category);
    return result ? { ...item, savedCount: result.savedCount, media: result.media.flatMap(media => urls.has(media.path) ? [{ id: media.id, url: urls.get(media.path)! }] : []) } : item;
  });
}
export async function signedPrivateMedia(client: SupabaseClient, items: { id: string; path: string }[]) {
  if (!items.length) return [];
  const { data, error } = await client.storage.from("discovery-media").createSignedUrls(items.map(item => item.path), 3600);
  if (error) throw error;
  return items.flatMap(item => { const signed = data.find(value => value.path === item.path); return signed?.signedUrl ? [{ id: item.id, url: signed.signedUrl }] : []; });
}
