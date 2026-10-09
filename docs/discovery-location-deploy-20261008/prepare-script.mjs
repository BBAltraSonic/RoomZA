import fs from "node:fs";
let source = fs.readFileSync("docs/shared-cards-deploy-20261008/release.mjs", "utf8");
source = source.replaceAll("docs/shared-cards-deploy-20261008", "docs/discovery-location-deploy-20261008")
  .replaceAll("artifacts/map-area-header-20261008/release.json", "docs/shared-cards-deploy-20261008/release.json")
  .replaceAll("pinpoint-shared-cards-release-", "pinpoint-discovery-location-release-")
  .replaceAll("shared-discovery-cards-20261008", "discovery-location-repair-20261008");
source = source.replace(/const expected = \[[\s\S]*?\];/, `const expected = [
  "src/app/offers/offers-discovery.tsx",
  "src/app/services/services-url-discovery.tsx",
  "src/features/discovery/url-controls.ts",
];`);
source = source.replace(/const added = \[[\s\S]*?\];/, `const added = [
  "src/features/discovery/use-discovery-search-params.ts",
  "src/features/discovery/use-discovery-search-params.test.tsx",
  "src/app/offers/offers-discovery.test.tsx",
];`);
source = source.replace(/await run\("focused-tests", [^\n]+/, `await run("focused-tests", "npx vitest run src/features/discovery/use-discovery-search-params.test.tsx src/app/offers/offers-discovery.test.tsx src/features/discovery/url-controls.test.tsx src/features/discovery/cloudflare-discovery-assets.test.ts --maxWorkers=1");`);
source = source.replace(/await run\("lint", [^\n]+/, `await run("lint", "npx eslint src/features/discovery/use-discovery-search-params.ts src/features/discovery/use-discovery-search-params.test.tsx src/features/discovery/url-controls.ts src/app/offers/offers-discovery.tsx src/app/offers/offers-discovery.test.tsx src/app/services/services-url-discovery.tsx");`);
source = source.replace('if (mode === "build") {', 'if (mode === "build") {\n    env.NODE_OPTIONS = "--max-old-space-size=1536";');
fs.writeFileSync("docs/discovery-location-deploy-20261008/release.mjs", source);
