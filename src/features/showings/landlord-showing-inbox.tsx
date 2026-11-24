import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

import { getLatestLandlordShowing } from "./actions";
import { ShowingRequestBannerLoader } from "./showing-request-banner-loader";

/**
 * The landlord's live showing-request banner (Accept / Decline), for the
 * layouts a signed-in landlord works in. Streams in behind the page so the
 * inbox read never delays it. Mount it once per layout tree.
 */
export function LandlordShowingInbox() {
  return (
    <Suspense fallback={null}>
      <LandlordShowingInboxContent />
    </Suspense>
  );
}

/**
 * Renders nothing for signed-out or anonymous visitors; the page itself owns
 * the sign-in redirect so its return path is kept.
 */
export async function LandlordShowingInboxContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return null;

  const initialRequest = await getLatestLandlordShowing();
  return <ShowingRequestBannerLoader landlordId={user.id} initialRequest={initialRequest} />;
}
