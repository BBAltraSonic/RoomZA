"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { publishNavigationIdentity } from "./navigation-account-events";
import { isRole, type Role } from "@/lib/roles";

export type NavigationAccount = {
  status: "loading" | "guest" | "authenticated";
  isAuthenticated: boolean;
  currentRole: Role | null;
  userEmail: string | null;
  hasAdminAccess: boolean;
};
const guest: NavigationAccount = { status: "guest", isAuthenticated: false, currentRole: null, userEmail: null, hasAdminAccess: false };
const initial: NavigationAccount = { ...guest, status: "loading" };
const ACCOUNT_TIMEOUT_MS = 5000;

// Display state only. Protected pages, actions and RLS authorize on the server.
export function useNavigationAccount(pathname: string) {
  const [account, setAccount] = useState<NavigationAccount>(initial);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let epoch = 0;
    let userId: string | null = null;
    let subscription: { unsubscribe(): void } | undefined;
    let controller: AbortController | undefined;
    let inFlight: Promise<void> | undefined;
    let scheduled: number | undefined;

    function invalidate() {
      epoch++;
      controller?.abort();
      controller = undefined;
      inFlight = undefined;
      clearTimeout(scheduled);
    }
    function showUser(user: Pick<User, "id" | "email">) {
      const sameUser = userId === user.id;
      userId = user.id;
      if (!sameUser) publishNavigationIdentity(user.id);
      setAccount(previous => ({
        ...(sameUser ? previous : guest),
        status: "authenticated", isAuthenticated: true,
        userEmail: user.email ?? (sameUser ? previous.userEmail : null),
      }));
    }

    void import("@/lib/supabase/browser").then(({ createClient }) => {
      if (disposed) return;
      const supabase = createClient();
      async function refresh() {
        if (disposed || inFlight) return;
        const current = epoch;
        const request = new AbortController();
        controller = request;
        const active = () => !disposed && current === epoch && !request.signal.aborted;
        const deadline = window.setTimeout(() => request.abort(), ACCOUNT_TIMEOUT_MS);
        // getUser has no abort option. Release a stalled auth read at the same deadline.
        const aborted = new Promise<never>((_, reject) => {
          request.signal.addEventListener("abort", () => reject(new DOMException("Account refresh cancelled", "AbortError")), { once: true });
        });
        const work = (async () => {
          try {
            const { data: { user }, error } = await Promise.race([supabase.auth.getUser(), aborted]);
            if (!active()) return;
            if (error) throw error;
            if (!user) { userId = null; publishNavigationIdentity(null); setAccount(guest); return; }
            showUser(user);
            // Identity is already usable. Profile and admin display reads settle independently.
            const profileRead = supabase.from("profiles").select("email,role").eq("id", user.id)
              .abortSignal(request.signal).maybeSingle().then(({ data: profile, error }) => {
                if (!active() || userId !== user.id || error || !profile) return;
                setAccount(previous => ({ ...previous,
                  currentRole: isRole(profile.role) ? profile.role : null,
                  userEmail: profile.email ?? user.email ?? null,
                }));
              });
            const adminRead = fetch("/api/navigation/account", { cache: "no-store", signal: request.signal })
              .then(async response => {
                if (!response.ok) return;
                const admin = await response.json();
                if (active() && userId === user.id) setAccount(previous => ({ ...previous, hasAdminAccess: admin?.hasAdminAccess === true }));
              });
            await Promise.race([Promise.allSettled([profileRead, adminRead]), aborted]);
          } catch {
            // An optional read failure must not turn a known signed-in user into a guest.
            if (!disposed && current === epoch && userId === null) setAccount(guest);
          } finally {
            window.clearTimeout(deadline);
          }
        })();
        inFlight = work;
        await work;
        if (inFlight === work) { inFlight = undefined; controller = undefined; }
      }
      refreshRef.current = () => { void refresh(); };
      subscription = supabase.auth.onAuthStateChange((event, session) => {
        if (disposed) return;
        invalidate();
        if (event === "SIGNED_OUT") { userId = null; publishNavigationIdentity(null); setAccount(guest); return; }
        if (session?.user) showUser(session.user);
        // SDK reads run only after the auth callback releases its lock.
        scheduled = window.setTimeout(() => { if (!disposed) void refresh(); }, 0);
      }).data.subscription;
      void refresh();
    }).catch(() => { if (!disposed) setAccount(guest); });

    return () => {
      disposed = true;
      invalidate();
      refreshRef.current = () => {};
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => { refreshRef.current(); }, [pathname]);
  return account;
}
