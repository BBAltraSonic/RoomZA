"use client";

import { usePresenceHeartbeat } from "./use-presence";

export function PresenceHeartbeat({ enabled }: { enabled: boolean }) {
  usePresenceHeartbeat({ enabled });
  return null;
}
