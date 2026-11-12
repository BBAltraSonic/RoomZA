// Removes the per-run folders a clone rehearsal leaves in `.cache`.
// Task scripts copy the app into `.cache/<run tag>-…` and link `node_modules` back to the checkout,
// so links are detached before anything is deleted: the shared `node_modules` must never be touched.
import { existsSync, lstatSync, readdirSync, rmdirSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";

const RUN_TAG = /^pinpoint-[a-z0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Unlinks every symlink or junction under `dir` without following it. */
function detachLinks(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      // Windows junctions to directories are removed with rmdir; ordinary symlinks with unlink.
      try { unlinkSync(target); } catch { rmdirSync(target); }
    } else if (entry.isDirectory()) {
      detachLinks(target);
    }
  }
}

/**
 * Deletes the `.cache` folders whose names start with `<runTag>-`.
 * @param {string} sourceRoot checkout root that holds `.cache`
 * @param {string} runTag the runner's tag, e.g. `pinpoint-release-<uuid>`
 * @returns {string[]} names of the folders removed
 */
export function removeRunWorkspaces(sourceRoot, runTag) {
  if (!RUN_TAG.test(runTag)) throw new Error(`Refusing to clean .cache: unexpected run tag ${JSON.stringify(runTag)}`);
  const cacheDir = path.join(path.resolve(sourceRoot), ".cache");
  if (!existsSync(cacheDir)) return [];
  const removed = [];
  for (const entry of readdirSync(cacheDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(`${runTag}-`)) continue;
    const workspace = path.join(cacheDir, entry.name);
    if (lstatSync(workspace).isSymbolicLink()) continue;
    detachLinks(workspace);
    rmSync(workspace, { recursive: true, force: true, maxRetries: 3 });
    removed.push(entry.name);
  }
  return removed;
}

/** Runner `finally` helper: cleanup problems are reported, never allowed to hide the run's own result. */
export function cleanUpRunWorkspaces(sourceRoot, runTag) {
  try {
    const removed = removeRunWorkspaces(sourceRoot, runTag);
    if (removed.length) console.info(`Removed ${removed.length} .cache workspace(s) for this run`);
  } catch (error) {
    console.warn(`Could not remove .cache workspaces for ${runTag}: ${error instanceof Error ? error.message : error}`);
  }
}
