"use client";

import { useEffect, useState, useTransition } from "react";
import { Fingerprint, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

type Passkey = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

export function PasskeyControls({ enabled }: { enabled: boolean }) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [supported] = useState(
    () => typeof window !== "undefined" && "PublicKeyCredential" in window,
  );
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      toast.error(error.message);
      return;
    }
    setPasskeys(data ?? []);
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void createClient()
      .auth.passkey.list()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          return;
        }
        setPasskeys(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <section className="mt-8 border-t border-border pt-6">
      <Fingerprint className="size-5 text-forest" />
      <h2 className="mt-3 text-lg font-semibold text-ink">Passkeys</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Experimental and optional. Password, OAuth, and TOTP remain available.
      </p>
      {!supported ? (
        <p className="mt-4 text-sm text-status-warning-text">
          This browser does not support passkeys.
        </p>
      ) : null}
      {passkeys.length ? (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-ink">
                  {passkey.friendly_name || "Passkey"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Added{" "}
                  {new Intl.DateTimeFormat("en-ZA", {
                    dateStyle: "medium",
                  }).format(new Date(passkey.created_at))}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Rename passkey"
                  onClick={() => {
                    const name = window.prompt(
                      "Passkey name",
                      passkey.friendly_name || "My passkey",
                    );
                    if (!name) return;
                    startTransition(async () => {
                      const supabase = createClient();
                      const { error } = await supabase.auth.passkey.update({
                        passkeyId: passkey.id,
                        friendlyName: name,
                      });
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      await refresh();
                    });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove passkey"
                  onClick={() =>
                    startTransition(async () => {
                      const supabase = createClient();
                      const { error } = await supabase.auth.passkey.delete({
                        passkeyId: passkey.id,
                      });
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      toast.success("Passkey removed");
                      await refresh();
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        className="mt-4"
        variant="outline"
        disabled={!supported || pending}
        onClick={() =>
          startTransition(async () => {
            const supabase = createClient();
            const { data, error } = await supabase.auth.registerPasskey();
            if (error || !data) {
              toast.error(error?.message ?? "Passkey registration failed.");
              return;
            }
            await supabase.auth.passkey.update({
              passkeyId: data.id,
              friendlyName: "My passkey",
            });
            toast.success("Passkey registered");
            await refresh();
          })
        }
      >
        <Fingerprint className="size-4" />
        Register passkey
      </Button>
    </section>
  );
}
