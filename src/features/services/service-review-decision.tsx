"use client";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
type Props = {
  id: string;
  version: number;
  status: string;
  decide: (input: { id: string; version: number; decision: "approve" | "reject" | "unpublish"; authorityNotes: string; locationNotes: string }) => Promise<{ ok: boolean; error?: string }>;
};
export function ServiceReviewDecision(props: Props) {
  return <ServiceReviewDecisionInstance key={`${props.id}:${props.version}:${props.status}`} {...props} />;
}
function ServiceReviewDecisionInstance({
  id,
  version,
  status,
  decide,
}: Props) {
  const router = useRouter();
  const mounted = useRef(true);
  const busy = useRef(false);
  const [, startTransition] = useTransition();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [authority, setAuthority] = useState("");
  const [location, setLocation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const submit = (decision: "approve" | "reject" | "unpublish") => {
    if (busy.current || !ready || !authority.trim() || (decision === "approve" && (!confirmed || !location.trim()))) return;
    busy.current = true;
    setPending(true);
    setError("");
    startTransition(async () => {
      let committed = false;
      try {
        const result = await decide({
          id,
          version,
          decision,
          authorityNotes: authority,
          locationNotes: location,
        });
        if (!mounted.current) return;
        if (!result.ok) {
          setError(result.error || "Decision failed.");
        } else {
          committed = true;
          router.refresh();
        }
      } catch {
        if (!mounted.current) return;
        setError(
          "Decision could not be completed. Reload the current submission before retrying.",
        );
      } finally {
        if (!committed) {
          busy.current = false;
          if (mounted.current) setPending(false);
        }
      }
    });
  };
  return (
    <fieldset disabled={pending || !ready} className="space-y-4">
      <label className="grid gap-2 text-sm font-medium">
        Provider, photo and public contact permission or rejection reason
        <textarea
          value={authority}
          maxLength={2000}
          onChange={(event) => setAuthority(event.target.value)}
          className="min-h-24 rounded-lg border border-border p-3"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Location review notes
        <textarea
          value={location}
          maxLength={2000}
          onChange={(event) => setLocation(event.target.value)}
          className="min-h-24 rounded-lg border border-border p-3"
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 size-5"
        />
        I checked the provider’s publishing permission, submitted photos and photo rights, public contacts and map location.
      </label>
      <div className="flex flex-wrap gap-3">
        {status === "submitted" ? (
          <>
            <Button
              type="button"
              disabled={!confirmed || !authority.trim() || !location.trim()}
              onClick={() => void submit("approve")}
            >
              Approve and publish service
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!authority.trim()}
              onClick={() => void submit("reject")}
            >
              Reject submission
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={!authority.trim()}
            onClick={() => void submit("unpublish")}
          >
            Unpublish service
          </Button>
        )}
      </div>
      {error ? (
        <div className="space-y-3"><p role="alert" className="text-sm text-status-error-text">
          {error}
        </p><Button type="button" variant="outline" onClick={() => router.refresh()}>Reload review queue</Button></div>
      ) : null}
    </fieldset>
  );
}
