export type DiscoveryRequestStatus = "idle" | "loading" | "refreshing" | "success" | "empty" | "error" | "offline";

export function discoveryRequestErrorMessage(errorCode: string, online: boolean): string {
  if (!online) return "You are offline. Reconnect to update homes in this area.";
  if (errorCode === "rate_limited") return "Map updates are temporarily limited. Try again in a moment.";
  if (errorCode === "validation_failed") return "This map area could not be searched. Recenter and try again.";
  return "Homes in this area could not be updated. Your previous results are still available.";
}
