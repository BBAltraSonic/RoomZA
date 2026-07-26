import Link from "next/link";

import { cn } from "@/lib/utils";

const applicantAudiences = [
  {
    id: "renters",
    label: "Rental applicants",
    href: "/dashboard/applicants",
  },
  {
    id: "buyers",
    label: "Buyers",
    href: "/dashboard/buyers",
  },
] as const;

export function ApplicantAudienceTabs({
  active,
}: {
  active: (typeof applicantAudiences)[number]["id"];
}) {
  return (
    <nav aria-label="Applicant type" className="mb-6 border-b border-border sm:mb-8">
      <div className="flex min-w-0 gap-5 overflow-x-auto">
        {applicantAudiences.map((audience) => {
          const isActive = audience.id === active;

          return (
            <Link
              key={audience.id}
              href={audience.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 text-sm font-semibold outline-none transition-colors duration-200 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-forest text-forest"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-ink",
              )}
            >
              {audience.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
