import type { NextRequest } from "next/server";

import { handleAuthCallback } from "@/features/auth/callback";

/**
 * OAuth/email-verification callback — thin wrapper delegating to
 * the feature module (R2.1).
 */
export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
