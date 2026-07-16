import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");

describe("application surface tokens", () => {
  it("keeps the compatibility surface token neutral instead of cream", () => {
    expect(globals).toContain("--warm-surface: oklch(0.968 0.003 165)");
    expect(globals).not.toContain("#f2ede4");
    expect(layout).not.toContain("#f2ede4");
  });

  it("uses restrained elevation without a bright neumorphic highlight", () => {
    expect(globals).toContain("--neu-light: transparent");
    expect(globals).toContain(
      "--property-card-shadow: var(--shadow-hairline), 0 2px 8px oklch(0.25 0.018 165 / 5%)",
    );
    expect(globals).not.toMatch(/--shadow-(?:surface|floating):[^;]*-[0-9]+px/);
  });

  it("overrides shared panel and canvas surfaces in dark mode", () => {
    const darkTheme = globals.slice(globals.indexOf(".dark {"), globals.indexOf("@layer base"));
    expect(darkTheme).toContain("--warm-surface: oklch(0.23 0.006 165)");
    expect(darkTheme).toContain("--panel: oklch(0.275 0.006 165)");
    expect(darkTheme).toContain("--neu-light: transparent");
  });
});
