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
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: accountActive } = await supabase.rpc("is_current_account_active" as never);
    const isStatusPath = request.nextUrl.pathname === "/account-suspended";
    const isSignOutPath = request.nextUrl.pathname === "/auth/sign-out";
    if (accountActive === false && !isStatusPath && !isSignOutPath) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: { code: "account_suspended", message: "Account access is suspended." }, requestId }, { status: 403, headers: { "cache-control": "no-store", "x-request-id": requestId } });
      }
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = "/account-suspended";
      suspendedUrl.search = "";
      return NextResponse.redirect(suspendedUrl);
    }
  }

  return response;
}
