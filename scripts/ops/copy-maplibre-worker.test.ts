import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("ships the installed worker and its matching shared module before each map build", () => {
  const root = process.cwd();
  const packagePath = createRequire(import.meta.url).resolve("maplibre-gl/package.json");
  const { version } = JSON.parse(readFileSync(packagePath, "utf8"));
  const destination = mkdtempSync(path.join(tmpdir(), "maplibre-worker-test-"));
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/ops/copy-maplibre-worker.mjs")], {
      cwd: destination,
    });
    for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
      expect(readFileSync(path.join(destination, "public/maplibre", version, file)))
        .toEqual(readFileSync(path.join(path.dirname(packagePath), "dist", file)));
    }
    const { scripts } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    for (const hook of ["predev", "prebuild", "prepreview:cf", "predeploy:cf"]) {
      expect(scripts[hook]).toBe("node scripts/ops/copy-maplibre-worker.mjs");
    }
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
});
