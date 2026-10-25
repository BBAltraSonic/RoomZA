import type { Metadata } from "next";
import { ListingCategoryWorkspace } from "@/features/marketplace/listing-category-workspace";
import { requireUser } from "@/lib/auth";
export const metadata: Metadata = { title: "Create listing", robots: { index: false, follow: false } };

export default async function CreateListingPage() {
  await requireUser({ redirectTo: "/post" });
  return <ListingCategoryWorkspace intent="create" />;
}
