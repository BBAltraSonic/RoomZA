import { notFound, permanentRedirect } from "next/navigation";

import { getPublicUsernameByProfileId } from "@/features/profile/data";

export default async function LegacyListerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const username = await getPublicUsernameByProfileId(id);
  if (!username) notFound();
  permanentRedirect(`/u/${username}`);
}
