import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // These saved rehearsal drivers deliberately execute as CommonJS.
  {
    files: [
      "scripts/db/discovery-phase3-browser-source.cjs",
      "scripts/db/services-discovery-browser.local.cjs",
      "scripts/db/pinpoint-phase5-browser-driver.prepared.cjs",
    ],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // App schemas use the shared zod so they get plain-language default messages.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/zod.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "zod", message: 'Use import * as z from "@/lib/zod" so schemas get the app\'s default messages.' }] },
      ],
    },
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
