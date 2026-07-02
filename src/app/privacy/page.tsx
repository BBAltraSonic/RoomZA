import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Pinpoint privacy policy — how we collect, use, and protect your personal information.",
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = "26 June 2025";
const CONTACT_EMAIL = "privacy@pinpoint.co.za";

export default function PrivacyPolicyPage() {
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

        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-ink/85">
          <section>
            <h2 className="text-lg font-semibold text-ink">1. Who we are</h2>
            <p className="mt-2">
              Pinpoint (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a rental property platform
              connecting renters and landlords in South Africa. This policy explains how we handle
              your personal information in compliance with the Protection of Personal Information Act
              (POPIA).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">2. Information we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong>Account information:</strong> email address, name, and profile photo when you
                sign in with Google or create an account with email and password.
              </li>
              <li>
                <strong>Profile data:</strong> your chosen role (renter or landlord) and any details
                you add to your profile.
              </li>
              <li>
                <strong>Listing data:</strong> property details, images, pricing, and location
                information that landlords submit.
              </li>
              <li>
                <strong>Application data:</strong> documents and information renters submit when
                applying for a property.
              </li>
              <li>
                <strong>Messages:</strong> conversations between renters and landlords through our
                platform.
              </li>
              <li>
                <strong>Usage data:</strong> pages visited, features used, and technical information
                such as browser type and IP address.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">3. How we use your information</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>To provide and maintain the Pinpoint platform.</li>
              <li>To authenticate your identity and secure your account.</li>
              <li>To facilitate communication between renters and landlords.</li>
              <li>To process rental applications and viewing requests.</li>
              <li>To send transactional notifications (e.g., new messages, application updates).</li>
              <li>To improve our services and fix issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">4. Third-party services</h2>
            <p className="mt-2">We use the following services to operate Pinpoint:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong>Supabase</strong> — authentication, database, and file storage.
              </li>
              <li>
                <strong>Google</strong> — OAuth sign-in and Maps for property locations.
              </li>
              <li>
                <strong>Cloudflare</strong> — hosting, bot protection (Turnstile), and content
                delivery.
              </li>
              <li>
                <strong>Resend</strong> — transactional email delivery.
              </li>
            </ul>
            <p className="mt-2">
              Each third-party service processes your data under their own privacy policy. We only
              share the minimum data required for each service to function.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">5. Data retention</h2>
            <p className="mt-2">
              We retain your personal information for as long as your account is active or as needed
              to provide our services. If you delete your account, we will remove your personal data
              within 30 days, except where we are required by law to retain it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">6. Your rights under POPIA</h2>
            <p className="mt-2">You have the right to:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your personal information.</li>
              <li>Object to the processing of your personal information.</li>
              <li>Withdraw consent at any time.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-forest underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">7. Security</h2>
            <p className="mt-2">
              We implement appropriate technical and organisational measures to protect your personal
              information, including encrypted connections (TLS), secure authentication, and access
              controls. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">8. Changes to this policy</h2>
            <p className="mt-2">
              We may update this privacy policy from time to time. We will notify you of significant
              changes by posting a notice on our platform. Continued use of Pinpoint after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">9. Contact</h2>
            <p className="mt-2">
              If you have questions about this privacy policy, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-forest underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <Link href="/terms" className="text-sm font-medium text-forest underline">
            Terms of Service →
          </Link>
        </div>
      </div>
    </main>
  );
}
