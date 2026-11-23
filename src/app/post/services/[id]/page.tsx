import { notFound } from "next/navigation";
import { z } from "zod";
import { readOwnedService } from "@/features/services/data";
import { ServiceEditor } from "@/features/services/service-workspace";
import { ServiceHoursEditor } from "@/features/services/service-hours-editor";
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
    <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-10 pb-28">
      <ServiceEditor initial={item} />
      {/* Saved straight away, apart from the reviewed listing: hours are not public content. */}
      <section aria-labelledby="service-hours-heading" className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-panel p-4 sm:p-6">
        <h2 id="service-hours-heading" className="text-lg font-semibold">Bookings</h2>
        <ServiceHoursEditor serviceId={item.id} />
      </section>
    </main>
  );
}
