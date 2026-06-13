import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requireServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export function createClient() {
  return createSupabaseClient<Database>(
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
