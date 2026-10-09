import { notFound } from "next/navigation";
import { z } from "zod";
import { readOwnedService } from "@/features/services/data";
import { ServiceEditor } from "@/features/services/service-workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Service Draft",
  robots: { index: false, follow: false },
};
export default async function ServiceDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!id.success) notFound();
  const item = await readOwnedService(id.data);
  if (!item) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 pb-28">
      <ServiceEditor initial={item} />
    </main>
  );
}
