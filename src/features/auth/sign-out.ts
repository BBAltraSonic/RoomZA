import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const SIGN_OUT_REDIRECT_PATH = "/";

/**
 * Sign the user out and return a redirect response to the public landing page.
 *
 * Domain logic extracted to satisfy feature-first placement (R2.1).
 */
export async function handleSignOut(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(SIGN_OUT_REDIRECT_PATH, request.url));
}
