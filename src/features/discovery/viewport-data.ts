import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { viewportQuerySchema, viewportResponseSchema, type ViewportQuery } from "./viewport-contract";

export async function readDiscoveryViewport(input: ViewportQuery, signal?: AbortSignal) {
  const query = viewportQuerySchema.parse(input);
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store", signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10000)]) }) },
  });
  const { data, error } = await client.rpc("pinpoint_discovery_viewport", {
    category: query.category, ...query.bounds, search_query: query.q, sort_order: query.sort, service_type: query.serviceType,
  });
  if (error) throw error;
  const result = viewportResponseSchema.parse(data);
  if (result.category !== query.category || Object.keys(query.bounds).some(key => result.bounds[key as keyof typeof query.bounds] !== query.bounds[key as keyof typeof query.bounds])) throw new Error("Wrong viewport");
  return result;
}
