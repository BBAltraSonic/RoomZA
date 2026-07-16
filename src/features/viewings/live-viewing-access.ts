const roomOpenLeadMs = 10 * 60 * 1000;
const roomCloseLagMs = 2 * 60 * 60 * 1000;

export function canJoinLiveViewing({
  status,
  mode,
  startsAt,
  endsAt,
  now,
}: {
  status: string;
  mode: string;
  startsAt: string;
  endsAt: string;
  now: Date;
}) {
  if (status !== "booked" || mode !== "video_call") return false;

  const startsAtMs = new Date(startsAt).getTime();
  const endsAtMs = new Date(endsAt).getTime();
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= startsAtMs) return false;

  const nowMs = now.getTime();
  return nowMs >= startsAtMs - roomOpenLeadMs && nowMs <= endsAtMs + roomCloseLagMs;
}

export function liveViewingBackUrl({
  listingId,
  landlordId,
  userId,
}: {
  listingId: string;
  landlordId: string;
  userId: string;
}) {
  return landlordId === userId ? `/dashboard/listings/${listingId}/applicants` : "/applications";
}
