import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
const design = readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf8");

describe("application surface tokens", () => {
  it("uses the green reference palette and uniform shape roles", () => {
    expect(globals).toContain("--forest: oklch(0.42 0.07 162)");
    expect(globals).toContain("--warm-surface: oklch(0.93 0.006 165)");
    expect(globals).toContain("--panel: oklch(0.985 0.002 165)");
    expect(globals).toContain("--surface-floating: oklch(0.97 0.003 165 / 97%)");
    expect(globals).toContain("--surface-results: oklch(0.948 0.005 165)");
    expect(globals).toContain("--ink: oklch(0.29 0.02 165)");
    expect(globals).toContain("--gold: oklch(0.82 0.095 82)");
    expect(globals).toContain("--radius-control: 12px");
    expect(globals).toContain("--radius-card: 12px");
    expect(globals).toContain("--radius-panel: 16px");
    expect(globals).toContain("--radius-sheet: 24px");
    expect(globals).toContain("--radius-cut: var(--radius-card)");
  });

  it("uses restrained cool elevation without the obsolete neumorphic contract", () => {
    expect(globals).toContain(
      "--shadow-control: var(--shadow-hairline), 0 1px 4px oklch(0.25 0.018 165 / 3%)",
    );
    expect(globals).toContain(
      "--shadow-card: 0 1px 2px oklch(0.25 0.018 165 / 4%), 0 5px 14px oklch(0.25 0.018 165 / 3%)",
    );
    expect(globals).toContain(
      "--shadow-floating: 0 2px 6px oklch(0.25 0.018 165 / 5%), 0 12px 30px oklch(0.25 0.018 165 / 6%)",
    );
    expect(globals).not.toMatch(/rgb\((?:56 38 30|48 32 26|41 28 23)/);
    expect(globals).not.toContain("--neu-");
  });

  it("provides a green-neutral dark counterpart", () => {
    const darkTheme = globals.slice(globals.indexOf(".dark {"), globals.indexOf("@layer base"));
    expect(darkTheme).toContain("--forest: oklch(0.8 0.095 158)");
    expect(darkTheme).toContain("--warm-surface: oklch(0.285 0.006 165)");
    expect(darkTheme).toContain("--panel: oklch(0.335 0.007 165)");
    expect(darkTheme).toContain(
      "--shadow-floating: 0 2px 6px oklch(0.08 0.008 165 / 18%), 0 12px 30px oklch(0.08 0.008 165 / 18%)",
    );
  });

  it("publishes matching browser chrome colors", () => {
    expect(layout).toContain('color: "#f7faf8"');
    expect(layout).toContain('color: "#272b29"');
  });

  it("removes the previous warm reference literals from the shared system", () => {
    const sharedSystem = `${globals}\n${layout}\n${design}`.toLowerCase();
    for (const warmLiteral of ["#eeedeb", "#f8f2ec", "#211c18", "#ffb268", "#f2d6ae"]) {
      expect(sharedSystem).not.toContain(warmLiteral);
    }
  });

  it("resolves the stored or system theme before every route paints", () => {
    expect(layout).toContain('localStorage.getItem("roomza-theme")');
    expect(layout).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(layout).toContain('classList.toggle("dark", isDark)');
    expect(layout).toContain("suppressHydrationWarning");
  });

  it("keeps long vertical result rails faded in every scroll state", () => {
    expect(globals).toContain(
      '.scroll-edge-fade[data-orientation="vertical"][data-at-start="true"]',
    );
    expect(globals).toContain(
      '.scroll-edge-fade[data-orientation="vertical"][data-at-end="true"]',
    );
    expect(globals).toContain(
      '.scroll-edge-fade[data-orientation="vertical"][data-at-start="true"][data-at-end="true"]',
    );
    expect(globals).toContain(
      "black calc(100% - var(--scroll-fade-size)),\n      transparent",
    );
  });

  it("keeps core text and action pairs above WCAG contrast thresholds", () => {
    expect(contrastRatio("#222F29", "#F7FAF8")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#6A746F", "#FDFEFE")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FCFEFD", "#235941")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#EEF3F1", "#272B29")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#121E18", "#88D1A6")).toBeGreaterThanOrEqual(4.5);
  });
});

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
