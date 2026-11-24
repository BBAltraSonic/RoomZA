import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ART_SIZE, FACES, MOODS, POSES, STICKERS, displaySize, pikoSrc, type PikoArtName } from "./art";

const ALL_ART: PikoArtName[] = [...POSES, ...FACES, ...STICKERS, "avatar-ring"];

describe("Piko art", () => {
  it("should_have_a_file_in_public_for_every_piece_of_art", () => {
    for (const name of ALL_ART) {
      const file = path.join(process.cwd(), "public", pikoSrc(name));
      expect(existsSync(file), `${name} → ${file}`).toBe(true);
    }
  });

  it("should_know_the_pixel_size_of_every_piece_of_art", () => {
    for (const name of ALL_ART) {
      expect(ART_SIZE[name].width, name).toBeGreaterThan(0);
      expect(ART_SIZE[name].height, name).toBeGreaterThan(0);
    }
  });

  it("should_point_every_mood_at_art_that_exists", () => {
    for (const [mood, { pose, face }] of Object.entries(MOODS)) {
      expect(ALL_ART, mood).toContain(pose);
      expect(ALL_ART, mood).toContain(face);
    }
  });

  it("should_never_show_piko_grumpy_at_the_person", () => {
    for (const { face } of Object.values(MOODS)) expect(face).not.toBe("grumpy");
  });

  it("should_cap_the_display_height_at_half_the_pixel_height_to_stay_sharp", () => {
    // peek is 117×258 px, so it stays sharp up to 129 CSS px tall.
    expect(displaySize("peek", 400)).toEqual({ width: 59, height: 129 });
    expect(displaySize("peek", 100)).toEqual({ width: 45, height: 100 });
  });
});

describe("dock face", () => {
  it("should_show_the_welcome_moods_face_in_the_dock", async () => {
    const { DOCK_FACE_SRC } = await import("./face-frame");
    const { MOODS, pikoSrc } = await import("./art");
    expect(DOCK_FACE_SRC).toBe(pikoSrc(MOODS.welcome.face));
  });
});
