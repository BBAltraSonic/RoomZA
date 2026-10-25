import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
const design = readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf8");

describe("application surface tokens", () => {
  it("publishes charcoal and amber roles with legacy compatibility aliases", () => {
    expect(globals).toContain("/* #151A24 */");
    expect(globals).toContain("/* #D89B23 */");
    expect(globals).toContain("--forest: var(--primary)");
    expect(globals).toContain("--clay: var(--brand-ink)");
    expect(globals).toContain("--selection: var(--brand-amber)");
    expect(globals).toContain("--selection-foreground: var(--brand-charcoal)");
    expect(globals).toContain("--radius-card: 20px");
    expect(globals).toContain("--radius-panel: 24px");
    expect(globals).not.toContain("--neu-");
  });

  it("uses dark browser chrome in either content theme", () => {
    expect(layout.match(/color: "#151A24"/g)).toHaveLength(2);
    expect(design).toContain("Maps stay dark in both themes");
    expect(globals).not.toContain("#E3F2FD");
    expect(globals).not.toContain("#90CAF9");
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

  it("keeps reference action and selection pairs readable", () => {
    expect(contrastRatio("#151A24", "#D89B23")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#151A24", "#FBFAF7")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#805600", "#F2F0EC")).toBeGreaterThanOrEqual(4.5);
  });

  for (const theme of ["light", "dark"] as const) {
    it(`keeps ${theme} semantic text readable on its rendered surfaces`, () => {
      const start = globals.indexOf(":root {");
      const darkStart = globals.indexOf(".dark {");
      const tokens = extractTokens(globals.slice(start, globals.indexOf("body[data-mobile-nav")));
      if (theme === "dark") Object.assign(tokens, extractTokens(globals.slice(darkStart, globals.indexOf("\n}", darkStart) + 2)));
      const ratio = (foreground: string, background: string) => contrastFromLuminance(tokenLuminance(foreground, tokens), tokenLuminance(background, tokens));
      for (const surface of ["background", "panel"]) {
        for (const text of ["ink", "muted-foreground", "forest", "clay", "destructive"]) {
          expect(ratio(text, surface), `${theme} ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const tone of ["success", "warning", "error", "info"]) {
        expect(ratio(`status-${tone}-text`, `status-${tone}-surface`), `${theme} ${tone}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio("primary-foreground", "primary")).toBeGreaterThanOrEqual(4.5);
      expect(ratio("selection-foreground", "selection")).toBeGreaterThanOrEqual(4.5);
      expect(ratio("ring", "panel")).toBeGreaterThanOrEqual(3);
      expect(ratio("input", "panel")).toBeGreaterThanOrEqual(3);
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
