import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign the user out and return a redirect response to the auth page.
 *
 * Domain logic extracted to satisfy feature-first placement (R2.1).
 */
export async function handleSignOut(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth", request.url));
}
