"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EntryWorkspace } from "./workspace-data";
import { requestEntryWorkspace } from "./workspace-request";
import { useWorkspaceReady } from "@/features/offers/use-workspace-ready";
import { privateEntryStatus } from "./workspace-contract";

const categoryTitle = { tourism: "Tourism", event: "Events" } as const;

export function EntryCategoryWorkspace({ workspace, page }: { workspace: EntryWorkspace; page: number }) {
  const router = useRouter();
  const ready = useWorkspaceReady();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const busyRef = useRef(false);

  async function enroll() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNextPath(undefined);
    try {
      const result = await requestEntryWorkspace({ category: workspace.category }, true);
      if (!result.ok) { setError(result.message); setNextPath(result.nextPath); return; }
      router.refresh();
    } catch {
      setError("Could not complete this request. Try again when your connection is available.");
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function createDraft() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNextPath(undefined);
    const entryId = crypto.randomUUID();
    try {
      const result = await requestEntryWorkspace({ command: "create", entryId, category: workspace.category, expectedVersion: 0 });
      if (!result.ok) { setError(result.message); setNextPath(result.nextPath); return; }
      if ("entryId" in result.data) router.push(`/post/entries/${workspace.category}/${result.data.entryId}`);
    } catch {
      setError("Could not create the draft. Your account and existing entries are unchanged.");
    } finally { busyRef.current = false; setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
      <div><p className="text-sm font-semibold">{categoryTitle[workspace.category]} poster access</p><p className="mt-1 text-sm text-muted-foreground">{workspace.enrollment === "active" ? "Enrolled for this category." : workspace.enrollment === "revoked" ? "Access to this category has been revoked." : "Enroll separately to create and manage private entries."}</p></div>
      {workspace.enrollment === "required" ? <Button className="min-h-11" disabled={!ready || busy} onClick={() => void enroll()}>{busy ? "Please wait…" : `Enroll in ${categoryTitle[workspace.category]}`}</Button> : null}
      {workspace.enrollment === "active" ? <Button className="min-h-11" disabled={!ready || busy} onClick={() => void createDraft()}>{busy ? "Creating…" : `New ${workspace.category === "event" ? "Event" : "Tourism entry"}`}</Button> : null}
    </div>
    {workspace.enrollment === "active" ? <section className="space-y-3" aria-labelledby="entry-list-heading">
      <h2 id="entry-list-heading" className="text-lg font-semibold">Your {categoryTitle[workspace.category].toLowerCase()} entries</h2>
      {workspace.entries.length ? <ul className="divide-y divide-border border-y border-border">{workspace.entries.map((entry) => <li key={entry.id}>
        <Link href={`/post/entries/${workspace.category}/${entry.id}`} className="flex min-h-16 flex-col gap-1 rounded-lg px-2 py-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="break-words font-medium">{entry.draft.title || "Untitled entry"}</span>
          <span className="text-sm text-muted-foreground">{privateEntryStatus(entry)} · Version {entry.version}</span>
        </Link>
      </li>)}</ul> : <p className="py-5 text-sm text-muted-foreground">{page === 1 ? `Create a private draft to add your first ${workspace.category === "event" ? "Event" : "Tourism entry"}.` : "No entries on this page."}</p>}
      <nav aria-label="Entry pages" className="flex gap-5 text-sm font-semibold text-forest">{page > 1 ? <Link className="inline-flex min-h-11 items-center" href={`/post/entries/${workspace.category}?page=${page - 1}`}>Previous</Link> : null}{workspace.hasNext && page < 10000 ? <Link className="inline-flex min-h-11 items-center" href={`/post/entries/${workspace.category}?page=${page + 1}`}>Next</Link> : null}</nav>
    </section> : null}
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{nextPath ? <Link className="underline" href={nextPath}>Continue to your account</Link> : null}</div> : null}
  </div>;
}
