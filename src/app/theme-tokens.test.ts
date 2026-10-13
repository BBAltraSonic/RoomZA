import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
const design = readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf8");

describe("application surface tokens", () => {
  it("uses the blue canvas with forest accents and uniform shape roles", () => {
    expect(globals).toContain("--forest: oklch(0.42 0.07 162)");
    expect(globals).toContain("--app-sky: #E3F2FD");
    expect(globals).toContain("--panel: oklch(0.985 0.002 165)");
    expect(globals).toContain("--surface-floating: oklch(0.97 0.003 165 / 97%)");
    expect(globals).toContain("--surface-results: var(--warm-surface)");
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
    expect(layout).toContain('color: "#E3F2FD"');
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
    expect(contrastRatio("#222F29", "#E3F2FD")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#1E3A5F", "#E3F2FD")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FCFEFD", "#1E3A5F")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#90CAF9", "#272B29")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#121E18", "#90CAF9")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#6A746F", "#FDFEFE")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FCFEFD", "#235941")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#EEF3F1", "#272B29")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#121E18", "#88D1A6")).toBeGreaterThanOrEqual(4.5);
  });

  for (const theme of ["light", "dark"] as const) {
    it(`keeps ${theme} semantic text readable on its rendered surfaces`, () => {
      const start = globals.indexOf(":root {");
      const darkStart = globals.indexOf(".dark {");
      const tokens = extractTokens(globals.slice(start, globals.indexOf("body[data-mobile-nav")));
      if (theme === "dark") Object.assign(tokens, extractTokens(globals.slice(darkStart, globals.indexOf("@layer base"))));
      const ratio = (foreground: string, background: string) => contrastFromLuminance(tokenLuminance(foreground, tokens), tokenLuminance(background, tokens));
      for (const surface of ["background", "panel"]) {
        for (const text of ["ink", "muted-foreground", "forest", "clay", "destructive"]) {
          expect(ratio(text, surface), `${theme} ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const tone of ["success", "warning", "error", "info"]) {
        expect(ratio(`status-${tone}-text`, `status-${tone}-surface`), `${theme} ${tone}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio("primary-foreground", "forest")).toBeGreaterThanOrEqual(4.5);
      expect(ratio("primary-foreground", "forest-hover")).toBeGreaterThanOrEqual(4.5);
      expect(ratio("ring", "background")).toBeGreaterThanOrEqual(3);
      expect(ratio("ring", "panel")).toBeGreaterThanOrEqual(3);
      expect(ratio("destructive-foreground", "destructive")).toBeGreaterThanOrEqual(4.5);
      for (const text of ["media-foreground", "media-muted", "media-error"]) {
        expect(ratio(text, "media-surface"), `${theme} ${text}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

function extractTokens(css: string): Record<string, string> {
  return Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]));
}

function contrastFromLuminance(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function tokenLuminance(name: string, tokens: Record<string, string>): number {
  const value = tokens[name];
  if (!value) throw new Error(`Missing color token: ${name}`);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  if (alias) return tokenLuminance(alias[1]!, tokens);
  if (value.startsWith("#")) return relativeLuminance(value);
  const match = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (!match) throw new Error(`Unsupported color: ${name} ${value}`);
  const [lightness, chroma, hue] = match.slice(1).map(Number) as [number, number, number];
  const angle = hue * Math.PI / 180;
  const a = chroma * Math.cos(angle), b = chroma * Math.sin(angle);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621*l-3.3077115913*m+0.2309699292*s, -1.2684380046*l+2.6097574011*m-0.3413193965*s, -0.0041960863*l-0.7034186147*m+1.707614701*s].map(channel => Math.max(0, Math.min(1, channel))) as [number, number, number];
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
}

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
