// Regression guard: every `next/dynamic` component on the discovery page must
// own a Suspense boundary.
//
// In the app router, `dynamic()` only wraps the lazy component in <Suspense>
// when it has a `loading` option or `ssr: false`
// (node_modules/next/dist/shared/lib/lazy-dynamic/loadable.js:
// `hasSuspenseBoundary = !opts.ssr || !!opts.loading`). Without either, a chunk
// that is still downloading suspends the nearest boundary further up, which on
// the discovery page is the layout-level one: the whole workspace, map
// included, was swapped for the page fallback. In dev (Strict Mode) the reveal
// re-ran the map's effects on the same container and react-map-gl looped
// forever, freezing the tab. `DiscoveryExploreSections` caused exactly this
// until it was given `loading: () => null`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Source files whose lazy components render inside the map workspace. */
const SCANNED_FILES = [
  "src/features/map-discovery/discovery-page.tsx",
  "src/features/discovery/discovery-stage.tsx",
];

type DynamicCall = { name: string; call: string };

/** Returns each `const X = dynamic(...)` with the full text of its call. */
function findDynamicCalls(source: string): DynamicCall[] {
  const calls: DynamicCall[] = [];
  const declaration = /const\s+(\w+)\s*=\s*dynamic\s*\(/g;
  for (let match = declaration.exec(source); match; match = declaration.exec(source)) {
    const name = match[1];
    if (!name) continue;
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let end = open;
    for (; end < source.length; end++) {
      if (source[end] === "(") depth++;
      else if (source[end] === ")" && --depth === 0) break;
    }
    calls.push({ name, call: source.slice(open, end + 1) });
  }
  return calls;
}

/** True when next/dynamic would wrap this component in its own Suspense boundary. */
function hasOwnSuspenseBoundary(call: string): boolean {
  return /\bloading\s*:/.test(call) || /\bssr\s*:\s*false\b/.test(call);
}

describe("discovery page lazy components", () => {
  it.each(SCANNED_FILES)("give every dynamic() import in %s its own Suspense boundary", (file) => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    const calls = findDynamicCalls(source);

    // Guard against the scan silently matching nothing after a refactor.
    expect(calls.length).toBeGreaterThan(0);

    const unbounded = calls.filter(({ call }) => !hasOwnSuspenseBoundary(call)).map(({ name }) => name);
    expect(unbounded, `add \`loading\` or \`ssr: false\` to: ${unbounded.join(", ")}`).toEqual([]);
  });

  it("flags a dynamic() import that has neither loading nor ssr: false", () => {
    const source = [
      "const Bounded = dynamic(() => import(\"./a\").then((m) => m.A), { loading: () => null });",
      "const ClientOnly = dynamic(() => import(\"./b\").then((m) => m.B), { ssr: false });",
      "const Unbounded = dynamic(() => import(\"./c\").then((m) => m.C));",
      "const ServerRendered = dynamic(() => import(\"./d\"), { ssr: true });",
    ].join("\n");

    const unbounded = findDynamicCalls(source)
      .filter(({ call }) => !hasOwnSuspenseBoundary(call))
      .map(({ name }) => name);

    expect(unbounded).toEqual(["Unbounded", "ServerRendered"]);
  });
});
