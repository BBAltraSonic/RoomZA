import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/premium/primitives";
import { ListingRestrictionControls } from "@/features/admin/components/admin-actions";
import { AdminHeader, DetailList } from "@/features/admin/components/admin-ui";
import { getAdminListing } from "@/features/admin/data";
import { formatPrice } from "@/lib/utils";

export default async function AdminListingDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const data = await getAdminListing(id); if (!data) notFound(); const active = data.restrictions.find((item) => !item.restored_at); return <><AdminHeader title={data.listing.title} description={data.listing.address} /><div className="mb-4 flex gap-2"><StatusBadge>{data.listing.status}</StatusBadge>{active ? <StatusBadge tone="error">Hidden from public discovery</StatusBadge> : <StatusBadge tone="success">Public visibility allowed</StatusBadge>}</div><DetailList items={[{ label: "Listing ID", value: data.listing.id }, { label: "Landlord", value: data.listing.landlord?.full_name || data.listing.landlord?.email || data.listing.landlord_id }, { label: "Price", value: formatPrice(data.listing.price) }, { label: "Created", value: new Date(data.listing.created_at).toLocaleString("en-ZA") }]} /><div className="mt-4"><ListingRestrictionControls listingId={id} restricted={Boolean(active)} /></div></>; }
