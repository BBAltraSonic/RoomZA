import type { PikoMood } from "./art";

/**
 * Everything Piko says, as fixed sentences picked by key (docs/piko-character-bible.md). The AI
 * never writes these: it only picks a template, and the template picks a key.
 *
 * - `tone: "calm"` lines are for anything that went wrong or isn't possible: no emoji, no
 *   catchphrases and no upbeat faces.
 * - Keys with several lines rotate through them so a regular doesn't see the same sentence every
 *   time. The version shown is stored with the chat entry, so a reload shows the same line.
 */

/** Piko's catchphrases. Each belongs to one moment and never appears in a calm line. */
export const SIGNATURE_PHRASES = [
  "I've got a pinpoint on that!",
  "Wait, I found something!",
  "Let's find you something better.",
  "Don't worry, I've got my eyes open.",
  "Something interesting just popped up!",
] as const;

type PikoLine = { mood: PikoMood; tone: "light" | "calm"; lines: readonly [string, ...string[]] };

export const PIKO_LINES = {
  welcome: { mood: "welcome", tone: "light", lines: ["Hi, I'm Piko."] },
  welcome_back: {
    mood: "hello",
    tone: "light",
    lines: ["Welcome back. Your last search is still here if you want to pick up where you left off."],
  },
  searching: {
    mood: "searching",
    tone: "light",
    lines: ["I've got a pinpoint on that!", "On it, having a look now.", "Let me dig around for that."],
  },
  found: { mood: "found", tone: "light", lines: ["Wait, I found something!"] },
  nothing_found: { mood: "noResults", tone: "calm", lines: ["I couldn't find anything that matches here. Try a suggestion, or move the map."] },
  working_out: { mood: "searching", tone: "calm", lines: ["Still working out the rest of that…"] },
  alert_fired: { mood: "found", tone: "light", lines: ["Something interesting just popped up!"] },
  everything: { mood: "explore", tone: "light", lines: ["Here's everything in this map area."] },
  compare: { mood: "idea", tone: "light", lines: ["Here they are side by side."] },
  // The chat notes (chat-thread.ts). Same meaning as before, in Piko's voice.
  english_only: { mood: "thinking", tone: "calm", lines: ["I can only understand English for now. The suggestions below still work."] },
  allowance_used: {
    mood: "resting",
    tone: "calm",
    lines: ["That's all of today's AI searches. I used what I could understand, and the suggestions below still work."],
  },
  busy: { mood: "warning", tone: "calm", lines: ["I'm a bit swamped right now. I used what I could understand. Try me again in a minute."] },
  ai_unavailable: { mood: "thinking", tone: "calm", lines: ["I couldn't follow all of that, so I used the parts I understood."] },
  not_understood: { mood: "loading", tone: "calm", lines: ["I'm not sure what to search for there. Try a suggestion below, or say it another way."] },
} as const satisfies Record<string, PikoLine>;

export type PikoLineKey = keyof typeof PIKO_LINES;

/** The line for a key at a version. A missing or out-of-range version falls back to a valid one. */
export function pikoLine(key: PikoLineKey, version = 0): string {
  const lines: readonly [string, ...string[]] = PIKO_LINES[key].lines;
  const index = Number.isInteger(version) && version >= 0 ? version % lines.length : 0;
  return lines[index] ?? lines[0];
}

/** "Welcome back. 3 new places match your last search.", or the plain welcome back without new places. */
export function newMatchesLine(count: number | null): string {
  if (!count || count < 1) return pikoLine("welcome_back");
  return `Welcome back. ${count} new ${count === 1 ? "place matches" : "places match"} your last search.`;
}

/** The version to show next for a key, given the last one shown (never the same twice in a row). */
export function nextVersion(key: PikoLineKey, last: number | undefined): number {
  if (last === undefined) return 0;
  return (last + 1) % PIKO_LINES[key].lines.length;
}

export function pikoMood(key: PikoLineKey): PikoMood {
  return PIKO_LINES[key].mood;
}
