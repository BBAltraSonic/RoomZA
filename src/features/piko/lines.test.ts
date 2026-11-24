import { describe, expect, it } from "vitest";

import { MOODS } from "./art";
import { PIKO_LINES, SIGNATURE_PHRASES, newMatchesLine, nextVersion, pikoLine, type PikoLineKey } from "./lines";

const entries = Object.entries(PIKO_LINES) as [PikoLineKey, (typeof PIKO_LINES)[PikoLineKey]][];
const EMOJI = /\p{Extended_Pictographic}/u;
// Piko speaks plain, natural English (character bible, section 1).
const SLANG = /\b(howzit|lekker|eish|sharp sharp|ja nee|bru|boet|shame man|yebo|aweh)\b/i;
const UPBEAT_MOODS = new Set(["celebrate", "success", "found"]);

describe("Piko's lines", () => {
  it("should_give_every_key_at_least_one_short_complete_sentence", () => {
    for (const [key, { lines }] of entries) {
      expect(lines.length, key).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.length, line).toBeLessThanOrEqual(140);
        expect(line, line).toMatch(/[.!?…]$/);
        expect(line, line).toBe(line.trim());
      }
    }
  });

  it("should_use_a_mood_that_exists_for_every_key", () => {
    for (const [key, { mood }] of entries) expect(Object.keys(MOODS), key).toContain(mood);
  });

  it("should_never_use_slang", () => {
    for (const [, { lines }] of entries) for (const line of lines) expect(line).not.toMatch(SLANG);
  });

  it("should_keep_calm_lines_free_of_emoji_catchphrases_and_upbeat_faces", () => {
    for (const [key, { tone, mood, lines }] of entries) {
      if (tone !== "calm") continue;
      expect(UPBEAT_MOODS.has(mood), key).toBe(false);
      for (const line of lines) {
        expect(line, line).not.toMatch(EMOJI);
        for (const phrase of SIGNATURE_PHRASES) expect(line, line).not.toContain(phrase);
      }
    }
  });

  it("should_use_the_signature_phrases_in_their_moments", () => {
    expect(PIKO_LINES.searching.lines[0]).toBe("I've got a pinpoint on that!");
    expect(PIKO_LINES.found.lines[0]).toBe("Wait, I found something!");
  });

  it("should_wrap_a_version_that_is_out_of_range", () => {
    const { lines } = PIKO_LINES.searching;
    expect(pikoLine("searching", 0)).toBe(lines[0]);
    expect(pikoLine("searching", lines.length)).toBe(lines[0]);
    expect(pikoLine("searching", -1)).toBe(lines[0]);
    expect(pikoLine("searching")).toBe(lines[0]);
  });

  it("should_move_to_the_next_version_without_repeating_the_last_one", () => {
    const count = PIKO_LINES.searching.lines.length;
    expect(count).toBeGreaterThan(1);
    expect(nextVersion("searching", undefined)).toBe(0);
    expect(nextVersion("searching", 0)).toBe(1);
    expect(nextVersion("searching", count - 1)).toBe(0);
    // A key with a single line always stays on it.
    expect(nextVersion("busy", 0)).toBe(0);
  });
});

describe("welcome back", () => {
  it("should_count_new_places_in_plain_english", () => {
    expect(newMatchesLine(1)).toBe("Welcome back. 1 new place matches your last search.");
    expect(newMatchesLine(4)).toBe("Welcome back. 4 new places match your last search.");
  });

  it("should_fall_back_to_the_plain_welcome_back_line_without_new_places", () => {
    expect(newMatchesLine(0)).toBe(pikoLine("welcome_back"));
    expect(newMatchesLine(null)).toBe(pikoLine("welcome_back"));
  });
});
