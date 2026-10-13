import {defineConfig} from "vitest/config";
export default defineConfig({test:{include:["workers/notifications/**/*.test.ts"],environment:"node"}});
