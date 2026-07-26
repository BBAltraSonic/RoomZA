import type { RealtimePresenceState } from "@supabase/supabase-js";

import type { TourPresenceEntry, TourPresencePayload } from "./types";

function isTourPresencePayload(value: unknown): value is TourPresencePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<TourPresencePayload>;
  return (
    (payload.role === "host" || payload.role === "viewer")
    && typeof payload.joinedAt === "string"
    && Number.isFinite(Date.parse(payload.joinedAt))
  );
}

export function readTourPresence(
  state: RealtimePresenceState<TourPresencePayload>,
): TourPresenceEntry[] {
  return Object.entries(state)
    .flatMap(([key, payloads]) =>
      payloads
        .filter(isTourPresencePayload)
        .map((payload) => ({ key, ...payload })),
    )
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "host" ? -1 : 1;
      return Date.parse(a.joinedAt) - Date.parse(b.joinedAt);
    });
}

export function getViewerQueue(
  entries: TourPresenceEntry[],
  participantKey: string,
) {
  const viewers = getViewerRoster(entries);
  const participant = entries.find((entry) => entry.key === participantKey);
  const queueIndex = viewers.findIndex((entry) =>
    participant?.userId
      ? entry.userId === participant.userId
      : entry.key === participantKey
  );
  return {
    viewerCount: viewers.length,
    queuePosition: queueIndex >= 0 ? queueIndex + 1 : null,
  };
}

export function getViewerRoster(entries: TourPresenceEntry[]) {
  const seenUsers = new Set<string>();
  return entries
    .filter((entry) => entry.role === "viewer")
    .filter((entry) => {
      const identity = entry.userId ?? entry.key;
      if (seenUsers.has(identity)) return false;
      seenUsers.add(identity);
      return true;
    })
    .slice(0, 250);
}
