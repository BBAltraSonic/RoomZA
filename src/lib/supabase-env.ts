/**
 * Supabase's public URL and anon key.
 *
 * Checked by hand rather than with zod so the browser Supabase client, which
 * nearly every page loads, does not ship a validation library to the browser.
 * The error names the missing settings, the same way `@/lib/env` does.
 */
export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const invalid: string[] = [];
  if (!isHttpUrl(supabaseUrl)) invalid.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) invalid.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (invalid.length) {
    throw new Error(`Invalid environment configuration: ${invalid.join(", ")}`);
  }

  return { supabaseUrl: supabaseUrl as string, supabaseAnonKey: supabaseAnonKey as string };
}

function isHttpUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
