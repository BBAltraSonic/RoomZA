import { redirect } from "next/navigation";

import { authPathForRedirect, safeRedirectPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

// Keep old bookmarks working without a verification screen or email request.
export default async function VerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const destination = safeRedirectPath(params.redirect, "/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? destination : authPathForRedirect(destination));
}
