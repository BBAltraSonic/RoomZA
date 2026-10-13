import { notFound } from "next/navigation";
import { z } from "zod";
import { EntryDraftEditor } from "@/features/entries/entry-draft-editor";
import { entryCategorySchema } from "@/features/entries/schema";
import { readEntryWorkspaceDetail } from "@/features/entries/workspace-data";

export default async function EntryDraftPage({ params }: { params: Promise<{ category: string; id: string }> }) {
  const { category: rawCategory, id } = await params;
  const parsedCategory = entryCategorySchema.safeParse(rawCategory);
  if (!parsedCategory.success || !z.string().uuid().safeParse(id).success) notFound();
  const category = parsedCategory.data;
  const detail = await readEntryWorkspaceDetail(category, id);
  if (!detail) notFound();
  return <><h1 className="text-2xl font-semibold tracking-tight">Edit {category === "event" ? "Event" : "Place"}</h1><EntryDraftEditor key={`${category}:${id}`} category={category} detail={detail} /></>;
}
