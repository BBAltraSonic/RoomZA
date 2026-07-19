"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

/**
 * A phone opening the dev server over Wi-Fi cannot use 127.0.0.1 for
 * Supabase because that address points back to the phone. Keep the configured
 * port, but route loopback development services through the page's LAN host.
 */
export function resolveBrowserSupabaseUrl(configuredUrl: string, browserHostname?: string) {
  if (!browserHostname || LOOPBACK_HOSTS.has(browserHostname)) return configuredUrl;

  const url = new URL(configuredUrl);
  if (!LOOPBACK_HOSTS.has(url.hostname)) return configuredUrl;

  url.hostname = browserHostname;
  return url.origin;
}

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const browserHostname = typeof window === "undefined" ? undefined : window.location.hostname;

  return createBrowserClient<Database>(
    resolveBrowserSupabaseUrl(supabaseUrl, browserHostname),
    supabaseAnonKey,
  );
}
