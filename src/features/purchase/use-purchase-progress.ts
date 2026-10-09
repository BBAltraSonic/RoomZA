"use client";
import { useEffect, useRef, useState } from "react";
import { NAVIGATION_IDENTITY_EVENT } from "@/features/auth/navigation-account-events";
import { createClient } from "@/lib/supabase/browser";
import { normalizeCompletedStages, type PurchaseStage } from "./progress";

/** A fresh recipient-scoped read on each opened sale; cancellation prevents cross-card state. */
export function usePurchaseProgress(listingId: string, enabled: boolean) {
  const [loaded, setLoaded] = useState<{ id: string; stages: PurchaseStage[] } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [identityVersion, setIdentityVersion] = useState(0);
  useEffect(() => {
    const clearIdentity = () => {
      requestRef.current?.abort();
      setLoaded(null);
      setIdentityVersion(version => version + 1);
    };
    window.addEventListener(NAVIGATION_IDENTITY_EVENT, clearIdentity);
    return () => window.removeEventListener(NAVIGATION_IDENTITY_EVENT, clearIdentity);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    requestRef.current = abort;
    const deadline = window.setTimeout(() => abort.abort(), 5000);
    void (async () => {
      try {
        const client = createClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user || abort.signal.aborted) return;
        const result = await client.from("purchase_progress").select("completed_stages")
          .eq("user_id", user.id).eq("listing_id", listingId).abortSignal(abort.signal).maybeSingle();
        if (!abort.signal.aborted && !result.error) {
          setLoaded({ id: listingId, stages: normalizeCompletedStages(result.data?.completed_stages ?? []) });
        }
      } catch { /* The public listing remains usable when private progress is unavailable. */ }
    })();
    return () => { window.clearTimeout(deadline); abort.abort(); };
  }, [listingId, enabled, identityVersion]);
  return enabled && loaded?.id === listingId ? loaded.stages : [];
}
