/**
 * The swipe feed ships behind `SWIPE_FEED`: "off" (default), "preview" (only
 * with `?feed=1`, for staging) or "on". The server reads the mode and passes it
 * down as a prop; these helpers are safe on both sides.
 */
export type SwipeFeedMode = "off" | "preview" | "on";

export function parseSwipeFeedMode(value: string | undefined): SwipeFeedMode {
  const mode = value?.trim().toLowerCase();
  return mode === "on" || mode === "preview" ? mode : "off";
}

export function isSwipeFeedEnabled(mode: SwipeFeedMode, searchParams: Pick<URLSearchParams, "get">) {
  return mode === "on" || (mode === "preview" && searchParams.get("feed") === "1");
}
