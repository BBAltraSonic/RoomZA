import Link from "next/link";
import { readOwnedServices } from "@/features/services/data";
import { NewServiceButton } from "@/features/services/service-workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your Services",
  robots: { index: false, follow: false },
};
export default async function ServiceWorkspacePage() {
  const items = await readOwnedServices();
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10 pb-28">
      <header>
        <h1 className="text-3xl font-semibold">Your services</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Drafts and submissions are private. Approval publishes the reviewed
          provider details in Services.
        </p>
      </header>
      <NewServiceButton />
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="py-4">
              <Link
                href={"/post/services/" + item.id}
                className="inline-flex min-h-11 flex-col justify-center"
              >
                <span className="font-semibold text-forest">
                  {item.draft.title || "Untitled service"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {item.status} · Version {item.version}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No service drafts yet.</p>
      )}
      <Link
        href="/services"
        className="inline-flex min-h-11 items-center text-sm text-forest underline"
      >
        Browse services
      </Link>
    </main>
  );
}
