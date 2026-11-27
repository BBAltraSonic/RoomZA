import "server-only";

import { parseSwipeFeedMode, type SwipeFeedMode } from "./feature-flag";

/** `SWIPE_FEED` is not NEXT_PUBLIC, so only the server can read it. */
export function readSwipeFeedMode(env: Record<string, string | undefined> = process.env): SwipeFeedMode {
  return parseSwipeFeedMode(env.SWIPE_FEED);
}
