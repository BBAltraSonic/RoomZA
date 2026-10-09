import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Next.js does not emit the worker's sibling module when bundling MapLibre v6.
// Serve both files from the installed package, versioned to avoid stale caches.
const packagePath = createRequire(import.meta.url).resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(packagePath, "utf8"));
const dist = path.join(path.dirname(packagePath), "dist");
const destination = path.join(process.cwd(), "public", "maplibre", version);
mkdirSync(destination, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, file), path.join(destination, file));
}
