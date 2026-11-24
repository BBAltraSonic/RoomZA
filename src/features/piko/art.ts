/**
 * Piko's art (docs/piko-character-bible.md). The files are WebP cut-outs in public/piko, taken
 * from the character sheets in piko-kit. The art is final and small, so every piece carries its
 * pixel size and is never shown taller than half of it (sharp on 2× screens).
 */

export const POSES = [
  "wave", "point", "ponder", "search", "thumbs-up-phone", "jump", "stand", "sit", "peek", "lie-down", "back",
  "present", "arms-crossed", "thumbs-up", "tablet", "curious", "scheme", "dance", "sit-branded", "lie-chin",
  "map", "laptop", "magnifier",
] as const;

export const FACES = [
  "happy", "wink", "surprised", "thinking", "laugh", "sad", "determined",
  "excited", "wink-2", "gasp", "wonder", "giggle", "worried", "grumpy", "nervous",
] as const;

export const STICKERS = ["idea", "love", "party", "cool", "sleepy"] as const;

export type PikoPose = (typeof POSES)[number];
export type PikoFace = (typeof FACES)[number];
export type PikoSticker = (typeof STICKERS)[number];
export type PikoArtName = PikoPose | PikoFace | PikoSticker | "avatar-ring";

export const ART_SIZE: Record<PikoArtName, { width: number; height: number }> = {
  wave: { width: 292, height: 409 },
  point: { width: 242, height: 405 },
  ponder: { width: 218, height: 408 },
  search: { width: 206, height: 393 },
  "thumbs-up-phone": { width: 235, height: 403 },
  jump: { width: 238, height: 364 },
  stand: { width: 149, height: 260 },
  sit: { width: 157, height: 209 },
  peek: { width: 117, height: 258 },
  "lie-down": { width: 272, height: 178 },
  back: { width: 142, height: 256 },
  present: { width: 344, height: 597 },
  "arms-crossed": { width: 166, height: 368 },
  "thumbs-up": { width: 180, height: 369 },
  tablet: { width: 208, height: 366 },
  curious: { width: 187, height: 367 },
  scheme: { width: 176, height: 348 },
  dance: { width: 239, height: 362 },
  "sit-branded": { width: 213, height: 248 },
  "lie-chin": { width: 264, height: 207 },
  map: { width: 191, height: 278 },
  laptop: { width: 301, height: 219 },
  magnifier: { width: 159, height: 295 },
  happy: { width: 217, height: 231 },
  wink: { width: 219, height: 224 },
  surprised: { width: 221, height: 221 },
  thinking: { width: 224, height: 224 },
  laugh: { width: 214, height: 225 },
  sad: { width: 214, height: 219 },
  determined: { width: 200, height: 228 },
  excited: { width: 165, height: 187 },
  "wink-2": { width: 162, height: 182 },
  gasp: { width: 162, height: 188 },
  wonder: { width: 158, height: 181 },
  giggle: { width: 162, height: 173 },
  worried: { width: 164, height: 175 },
  grumpy: { width: 162, height: 171 },
  nervous: { width: 134, height: 160 },
  idea: { width: 127, height: 136 },
  love: { width: 128, height: 134 },
  party: { width: 142, height: 135 },
  cool: { width: 124, height: 134 },
  sleepy: { width: 158, height: 129 },
  "avatar-ring": { width: 166, height: 159 },
};

const FOLDER: Record<PikoArtName, string> = {
  ...(Object.fromEntries(POSES.map((name) => [name, "pose"])) as Record<PikoPose, string>),
  ...(Object.fromEntries(FACES.map((name) => [name, "face"])) as Record<PikoFace, string>),
  ...(Object.fromEntries(STICKERS.map((name) => [name, "sticker"])) as Record<PikoSticker, string>),
  "avatar-ring": "avatar",
};

export function pikoSrc(name: PikoArtName) {
  return `/piko/${FOLDER[name]}/piko-${name}.webp`;
}

/** The size to show a piece of art at: the height asked for, but never more than half its pixels. */
export function displaySize(name: PikoArtName, height: number) {
  const art = ART_SIZE[name];
  const shown = Math.min(Math.round(height), Math.floor(art.height / 2));
  return { width: Math.round((shown * art.width) / art.height), height: shown };
}

/**
 * App moments and the art that fits them: a full-body pose for empty states and a face for chat.
 * Piko never looks grumpy at the person, so "denied" is worried, not cross.
 */
export const MOODS = {
  welcome: { pose: "wave", face: "happy" },
  hello: { pose: "present", face: "excited" },
  searching: { pose: "magnifier", face: "thinking" },
  loading: { pose: "search", face: "wonder" },
  found: { pose: "point", face: "surprised" },
  success: { pose: "jump", face: "laugh" },
  celebrate: { pose: "dance", face: "giggle" },
  thinking: { pose: "ponder", face: "thinking" },
  idea: { pose: "curious", face: "wink" },
  empty: { pose: "lie-chin", face: "wonder" },
  noResults: { pose: "back", face: "worried" },
  error: { pose: "arms-crossed", face: "sad" },
  offline: { pose: "sit", face: "worried" },
  warning: { pose: "scheme", face: "nervous" },
  denied: { pose: "back", face: "worried" },
  resting: { pose: "lie-down", face: "sleepy" },
  tip: { pose: "peek", face: "wink" },
  explore: { pose: "map", face: "excited" },
  working: { pose: "laptop", face: "determined" },
  done: { pose: "thumbs-up", face: "happy" },
} as const satisfies Record<string, { pose: PikoPose; face: PikoFace | PikoSticker }>;

export type PikoMood = keyof typeof MOODS;
