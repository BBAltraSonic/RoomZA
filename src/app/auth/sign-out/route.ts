import type { NextRequest } from "next/server";

import { handleSignOut } from "@/features/auth/sign-out";

/**
 * Sign-out route — thin wrapper delegating to the feature module (R2.1).
 */
export async function POST(request: NextRequest) {
  return handleSignOut(request);
}
