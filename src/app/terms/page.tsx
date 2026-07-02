import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Pinpoint terms of service — rules and guidelines for using the platform.",
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = "26 June 2025";
const CONTACT_EMAIL = "support@pinpoint.co.za";

export default function TermsOfServicePage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Back to Pinpoint
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-ink">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-ink/85">
          <section>
            <h2 className="text-lg font-semibold text-ink">1. Acceptance of terms</h2>
            <p className="mt-2">
              By accessing or using Pinpoint (&quot;the platform&quot;), you agree to be bound by
              these Terms of Service. If you do not agree, you may not use the platform. These terms
              are governed by the laws of the Republic of South Africa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">2. About the platform</h2>
            <p className="mt-2">
              Pinpoint is an online platform that connects renters seeking accommodation with
              landlords listing rental properties in South Africa. We provide tools for property
              discovery, applications, messaging, and viewing scheduling. Pinpoint is not a party to
              any rental agreement between renters and landlords.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">3. Accounts</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                You must provide accurate information when creating an account. You may sign up using
                email and password or through Google Sign-In.
              </li>
              <li>
                You are responsible for maintaining the security of your account credentials.
              </li>
              <li>
                You must be at least 18 years old to create an account and use the platform.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that violate these terms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">4. User responsibilities</h2>
            <h3 className="mt-3 font-semibold text-ink">For all users:</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Do not use the platform for any unlawful purpose.</li>
              <li>Do not post false, misleading, or fraudulent content.</li>
              <li>Do not harass, abuse, or threaten other users.</li>
              <li>Do not attempt to circumvent platform security measures.</li>
            </ul>

            <h3 className="mt-4 font-semibold text-ink">For landlords:</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                Listings must accurately represent the property, including location, pricing,
                availability, and images.
              </li>
              <li>
                You must have legal authority to list the property for rent.
              </li>
              <li>
                You must comply with the Rental Housing Act and all applicable South African
                legislation.
              </li>
            </ul>

            <h3 className="mt-4 font-semibold text-ink">For renters:</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                Applications must contain truthful information.
              </li>
              <li>
                You are responsible for verifying a property in person before entering into any
                rental agreement.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">5. Listings and content</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                You retain ownership of content you submit (text, images, documents) but grant
                Pinpoint a non-exclusive, royalty-free licence to display it on the platform.
              </li>
              <li>
                We may remove content that violates these terms or is reported by other users.
              </li>
              <li>
                We do not verify the accuracy of listing information. Users interact at their own
                discretion.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">6. Applications and viewings</h2>
            <p className="mt-2">
              Pinpoint facilitates the application and viewing process between renters and landlords.
              We do not guarantee that an application will be accepted, a viewing will take place, or
              that a rental agreement will be reached. All decisions regarding tenancy are solely
              between the renter and landlord.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">7. Fees</h2>
            <p className="mt-2">
              Pinpoint is currently free to use for both renters and landlords. We reserve the right
              to introduce paid features in the future, with reasonable notice provided to users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">8. Limitation of liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, Pinpoint shall not be liable for any indirect,
              incidental, special, or consequential damages arising from your use of the platform.
              This includes, but is not limited to, losses arising from rental agreements,
              misrepresentation by other users, or platform unavailability.
            </p>
            <p className="mt-2">
              Pinpoint is a platform and not a party to any transaction. We do not guarantee the
              quality, safety, legality, or availability of any listed property.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">9. Termination</h2>
            <p className="mt-2">
              You may delete your account at any time. We may suspend or terminate your access if you
              violate these terms. Upon termination, your right to use the platform ceases
              immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">10. Changes to these terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. Material changes will be communicated
              through the platform. Continued use of Pinpoint after changes constitutes acceptance of
              the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">11. Governing law</h2>
            <p className="mt-2">
              These terms are governed by the laws of the Republic of South Africa. Any disputes
              shall be subject to the jurisdiction of the South African courts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">12. Contact</h2>
            <p className="mt-2">
              If you have questions about these terms, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-forest underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <Link href="/privacy" className="text-sm font-medium text-forest underline">
            Privacy Policy →
          </Link>
        </div>
      </div>
    </main>
  );
}
