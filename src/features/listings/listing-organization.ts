import type { Database } from "@/lib/supabase/types";

type ListingStatus = Database["public"]["Enums"]["listing_status"];

export type OrganizableListing = {
  title?: string | null;
  address?: string | null;
  status?: ListingStatus | null;
  updated_at?: string | null;
  created_at?: string | null;
  applications?: unknown[] | null;
};

export type ListingOrganizationParams = {
  q?: string | null;
  status?: ListingStatus | "all" | null;
  sort?: "recent" | "applicants" | null;
};

function applicantCount(listing: OrganizableListing) {
  return Array.isArray(listing.applications) ? listing.applications.length : 0;
}

function timeValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function organizeListings<T extends OrganizableListing>(listings: T[], params: ListingOrganizationParams = {}) {
  const term = (params.q ?? "").trim().slice(0, 100).toLocaleLowerCase();
  const status = params.status ?? "all";
  const sort = params.sort ?? "recent";

  return [...listings]
    .filter((listing) => {
      if (status === "all" && listing.status === "archived") return false;
      if (status !== "all" && listing.status !== status) return false;
      if (!term) return true;

      const haystack = `${listing.title ?? ""} ${listing.address ?? ""}`.toLocaleLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => {
      const recent = timeValue(b.updated_at ?? b.created_at) - timeValue(a.updated_at ?? a.created_at);
      const applicants = applicantCount(b) - applicantCount(a);

      if (sort === "applicants") {
        return applicants || recent;
      }

      return recent || applicants;
    });
}
