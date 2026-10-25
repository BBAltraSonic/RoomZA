import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLiveTour, getLiveTourTerminalState } from "@/features/live-tours/actions";
import { getInstantConnectPhase3Flags } from "@/features/live-tours/feature-flags";
import { LiveTourRoom } from "@/features/live-tours/live-tour-room";
import { LiveTourTerminal } from "@/features/live-tours/live-tour-terminal";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Live property tour",
  robots: { index: false, follow: false },
};

export default async function LiveTourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile } = await requireUser({
    redirectTo: `/live-tours/${id}`,
  });
  const [tour, flags] = await Promise.all([
    getLiveTour(id),
    getInstantConnectPhase3Flags(),
  ]);
  if (!tour) {
    const terminal = await getLiveTourTerminalState(id);
    if (terminal) return <LiveTourTerminal {...terminal} />;
    notFound();
  }

  return (
    <LiveTourRoom
      tour={tour}
      currentUserId={user.id}
      currentUserName={profile?.full_name?.trim() || "Pinpoint viewer"}
      flags={flags}
    />
  );
}
