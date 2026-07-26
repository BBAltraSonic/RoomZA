import { handlePresenceBeat } from "@/features/presence/api";

/**
 * Unload heartbeat endpoint for `navigator.sendBeacon` (design §3.1). A beacon
 * cannot invoke a server action, so this thin route calls the same throttled
 * `touch_presence` RPC using the user's session cookie. Presence is ambient:
 * an anonymous or malformed beacon is a benign no-op, never an error.
 */
export async function POST(request: Request) {
  return handlePresenceBeat(request);
}
