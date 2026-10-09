import { notFound } from "next/navigation";
import { entryCategorySchema } from "@/features/entries/schema";
import { EntryCategoryWorkspace } from "@/features/entries/entry-category-workspace";
import { readEntryWorkspace } from "@/features/entries/workspace-data";

export default async function EntryCategoryPage({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ category: rawCategory }, query] = await Promise.all([params, searchParams]);
  const parsedCategory = entryCategorySchema.safeParse(rawCategory);
  if (!parsedCategory.success) notFound();
  const category = parsedCategory.data;
  const rawPage = Number(query.page ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 10000 ? rawPage : 1;
  const workspace = await readEntryWorkspace(category, page);
  return <>
    <header className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Your {category === "event" ? "Events" : "Tourism entries"}</h1><p className="max-w-prose text-sm text-muted-foreground">Drafts and submissions in this workspace are visible to your account. Admin review and publication checks are separate.</p></header>
    <EntryCategoryWorkspace workspace={workspace} page={page} />
  </>;
}
