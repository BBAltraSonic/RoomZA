import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "../../src/lib/env";
import { requestContext, setCookies } from "./request-context.mjs";
import type { Database } from "../../src/lib/supabase/types";

// Same SSR cookie/session contract as the app, without importing Next's server.
export async function createClient() {
  const context = requestContext();
  if (!context.client) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    context.client = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => [...context.cookies].map(([name, value]) => ({ name, value })),
        setAll: setCookies,
      },
    });
  }
  return context.client as ReturnType<typeof createServerClient<Database>>;
}
