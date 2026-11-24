import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // These saved rehearsal drivers and Node preload hooks deliberately execute as CommonJS.
  {
    files: [
      "scripts/db/discovery-phase3-browser-source.cjs",
      "scripts/db/services-discovery-browser.local.cjs",
      "scripts/db/pinpoint-phase5-browser-driver.prepared.cjs",
      "scripts/assistant/allow-server-only.cjs",
    ],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "**/.cache/**",
    "artifacts/**",
    "out/**",
    "build/**",
    "tmp/**",
    ".agents/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
