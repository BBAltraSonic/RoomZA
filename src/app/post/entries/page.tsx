import Link from "next/link";
import { requireUser } from "@/lib/auth";

const categories = [
  { id: "tourism", title: "Places", description: "Add a continuing visitor experience with a venue and exact availability window." },
  { id: "event", title: "Events", description: "Manage a private Event entry with a venue and exact start and end times." },
] as const;

export default async function EntryWorkspaceHome() {
  await requireUser({ redirectTo: "/post/entries" });
  return <>
    <header className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Places and Events workspace</h1><p className="max-w-prose text-sm text-muted-foreground">Choose a category to create and manage your entries. Submitted drafts need review before publication.</p></header>
    <nav aria-label="Entry categories" className="divide-y divide-border border-y border-border">{categories.map((category) => <Link key={category.id} href={`/post/entries/${category.id}`} className="flex min-h-20 flex-col justify-center gap-1 rounded-lg px-2 py-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="font-semibold">{category.title}</span><span className="max-w-prose text-sm text-muted-foreground">{category.description}</span>
    </Link>)}</nav>
  </>;
}
