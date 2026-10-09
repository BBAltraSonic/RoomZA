import { z } from "zod";
import { notFound } from "next/navigation";
import { PublicEntryDetailScreen } from "@/features/entries/public-detail-screen";
export const dynamic="force-dynamic";
export default async function SpecialPage({params}:{params:Promise<{id:string}>}) {
  const id=z.string().uuid().safeParse((await params).id);if(!id.success)notFound();return <PublicEntryDetailScreen entryId={id.data}/>;
}
