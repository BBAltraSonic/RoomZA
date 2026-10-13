import { ContactPreview } from "@/features/guest-contact/contact-preview";
import { MediaReviewPreview } from "@/features/discovery/media-fields";
import Link from "next/link";
import {
  readServiceReviewQueue,
  decideService,
} from "@/features/services/data";
import { revalidatePath } from "next/cache";
import { ServiceReviewDecision } from "@/features/services/service-review-decision";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Review Local Services",
  robots: { index: false, follow: false },
};
export default async function ServiceReviewPage() {
  const queue = await readServiceReviewQueue();
  async function decide(input: {
    id: string;
    version: number;
    decision: "approve" | "reject" | "unpublish";
    authorityNotes: string;
    locationNotes: string;
  }) {
    "use server";
    try {
      await decideService(input);
      revalidatePath("/admin/services");
      revalidatePath("/services");
      return { ok: true };
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error;
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : null;
      return {
        ok: false,
        error:
          code === "PT409"
            ? "This submission changed. Reload the review queue before deciding."
            : "Could not record the decision. Check the required review notes and try again.",
      };
    }
  }
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Review local services</h1>
      <p className="text-sm text-muted-foreground">
        Confirm the provider’s permission and check the actual service location
        before approving publication. Submitted snapshots exclude unsaved edits.
      </p>
      {queue.length ? (
        queue.map((item) => (
          <section
            key={item.id}
            className="space-y-4 rounded-xl border border-border bg-panel p-5"
          >
<MediaReviewPreview category={"service"} target={item.id} content={item.submitted} />
            <h2 className="text-xl font-semibold">{item.submitted.title}</h2>
            <p className="text-sm text-muted-foreground">
              {item.status === "submitted"
                ? "Pending review"
                : "Published version"}
            </p>
            <p>
              {item.submitted.providerName} · {item.submitted.serviceType}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {item.submitted.description}
            </p>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd>{item.submitted.address}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Coordinates</dt>
                <dd>
                  {item.submitted.latitude}, {item.submitted.longitude}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Public phone</dt>
                <dd>{item.submitted.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Discovery area</dt>
                <dd>{item.submitted.areaId}</dd>
              </div>
            </dl>
            <a
              href={
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(
                  item.submitted.latitude + "," + item.submitted.longitude,
                )
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm text-forest underline"
            >
              Check map location
            </a>
            <ContactPreview contact={item.submitted.publicContact} consent={item.submitted.contactConsent} />
            <ServiceReviewDecision
              id={item.id}
              version={item.version}
              status={item.status}
              decide={decide}
            />
          </section>
        ))
      ) : (
        <p>No pending service submissions.</p>
      )}
      <Link
        href="/services"
        className="inline-flex min-h-11 items-center text-sm text-forest underline"
      >
        Public services
      </Link>
    </div>
  );
}
