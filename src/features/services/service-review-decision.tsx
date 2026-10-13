"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function ServiceReviewDecision({
  id,
  version,
  status,
  decide,
}: {
  id: string;
  version: number;
  status: string;
  decide: (input: {
    id: string;
    version: number;
    decision: "approve" | "reject" | "unpublish";
    authorityNotes: string;
    locationNotes: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
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
  const submit = async (decision: "approve" | "reject" | "unpublish") => {
    setPending(true);
    setError("");
    try {
      const result = await decide({
        id,
        version,
        decision,
        authorityNotes: authority,
        locationNotes: location,
      });
      if (!result.ok) {
        setError(result.error || "Decision failed.");
      } else {
        router.refresh();
      }
    } catch {
      setError(
        "Decision could not be completed. Reload the current submission before retrying.",
      );
    } finally {
      setPending(false);
    }
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
        <p role="alert" className="text-sm text-status-error-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
