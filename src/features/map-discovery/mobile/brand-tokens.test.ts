// Static brand-token guard for the Mobile_Map_Discovery components.
//
// This is a deterministic, fast source-scan test (no DOM, no rendering). It
// reads the new mobile component source files from disk and asserts that the
// themed elements use ONLY token-backed Tailwind classes (text-ink,
// text-forest, bg-forest) and contain NO literal hex / rgb() / rgba() / hsl()
// colors.
//
// Allowed (NOT flagged): Tailwind utilities like `border-white`, `bg-rose-50`,
// `text-muted-foreground`, and SVG `currentColor` — none of these are literal
// color values.
//
// See .kiro/specs/mobile-map-discovery/design.md (brand tokens / Req 10.5) and
// requirements.md (Req 10.5).
//
// Validates: Requirements 10.5

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** All new mobile component source files that must stay token-only. */
const COMPONENT_FILES = [
  "app-bar.tsx",
  "bottom-navigation-bar.tsx",
  "bottom-sheet.tsx",
  "listing-card.tsx",
  "listing-carousel.tsx",
  "listing-marker.tsx",
  "mobile-discovery-shell.tsx",
  "search-region.tsx",
  "sheet-header.tsx",
  "sort-label.tsx",
] as const;

/** Literal hex colors, e.g. #fff, #ffffff, #ffffffff. */
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
/** Literal color functions: rgb(), rgba(), hsl(), hsla(). */
const FUNC_COLOR = /\b(?:rgba?|hsla?)\s*\(/i;

function readComponent(file: string): string {
  return readFileSync(path.join(__dirname, file), "utf8");
}

describe("Mobile_Map_Discovery brand-token usage (Req 10.5)", () => {
  describe("no literal colors in any new mobile component", () => {
    it.each(COMPONENT_FILES)("%s contains no literal hex colors", (file) => {
      const source = readComponent(file);
      const match = source.match(HEX_COLOR);
      expect(
        match,
        match ? `${file} contains a literal hex color: "${match[0]}"` : undefined,
      ).toBeNull();
    });

    it.each(COMPONENT_FILES)(
      "%s contains no rgb()/rgba()/hsl()/hsla() literals",
      (file) => {
        const source = readComponent(file);
        const match = source.match(FUNC_COLOR);
        expect(
          match,
          match ? `${file} contains a literal color function: "${match[0]}"` : undefined,
        ).toBeNull();
      },
    );
  });

  describe("positive token assertions on themed elements", () => {
    it("Screen_Title (AppBar) uses the text-ink token", () => {
      expect(readComponent("app-bar.tsx")).toContain("text-ink");
    });

    it("Active_Nav_Button (BottomNavigationBar) uses the text-forest token", () => {
      expect(readComponent("bottom-navigation-bar.tsx")).toContain("text-forest");
    });

    it("Listing_Marker pin badge (ListingMarker) uses the bg-forest token", () => {
      expect(readComponent("listing-marker.tsx")).toContain("bg-forest");
    });
  });
});
