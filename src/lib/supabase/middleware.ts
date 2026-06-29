import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Refreshes the Supabase auth session on every request so access/refresh tokens
 * are rotated and persisted via cookies. Without this running in middleware,
 * Server Components cannot write refreshed cookies and users get logged out when
 * the access token expires.
 *
 * Security headers (CSP/HSTS/etc.) are owned exclusively by `next.config.ts`
 * `headers()` to avoid configuration drift between two sources.
 */
export async function updateSession(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  request.headers.set("x-request-id", requestId);

  let response = NextResponse.next({
    request,
  });
  response.headers.set("x-request-id", requestId);

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });
        response.headers.set("x-request-id", requestId);

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser().
  // getUser() triggers the token refresh + Set-Cookie via setAll above.
  await supabase.auth.getUser();

  return response;
}
