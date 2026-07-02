export const LIVE_VIDEO_CONNECT_TIMEOUT_MS = 10_000;

export type LiveVideoConnectionState = "connecting" | "connected" | "failed";

export function nextLiveVideoConnectionState(event: "load" | "timeout" | "retry"): LiveVideoConnectionState {
  if (event === "load") return "connected";
  if (event === "timeout") return "failed";
  return "connecting";
}
