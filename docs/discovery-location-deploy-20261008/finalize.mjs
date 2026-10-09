import fs from 'node:fs';
import crypto from 'node:crypto';
const dir = 'docs/discovery-location-deploy-20261008';
const release = JSON.parse(fs.readFileSync(dir + '/release.json'));
const before = JSON.parse(fs.readFileSync(dir + '/before-version.json'));
const after = JSON.parse(fs.readFileSync(dir + '/after-version.json'));
const deployments = JSON.parse(fs.readFileSync(dir + '/after-deployments.json')).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on));
const normalize = bindings => JSON.stringify([...bindings].sort((a,b) => a.name.localeCompare(b.name)));
const repairedFiles = new Set([...release.changedFiles, ...release.addedFiles]);
const allDrift = Object.entries(release.sourceHashes).filter(([file,hash]) => !fs.existsSync(file) || crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== hash).map(([file]) => file);
const sourceDrift = allDrift.filter(file => repairedFiles.has(file));
const smoke = JSON.parse(fs.readFileSync(dir + '/smoke.json'));
const browser = fs.existsSync(dir + '/browser.json') ? JSON.parse(fs.readFileSync(dir + '/browser.json')) : null;
release.result = {
  version: after.id, deployment: deployments[0].id, traffic: deployments[0].versions,
  bindingMatch: normalize(before.resources.bindings) === normalize(after.resources.bindings),
  compatibilityPreserved: JSON.stringify(before.resources.script_runtime) === JSON.stringify(after.resources.script_runtime),
  sourceDrift, concurrentUnshippedChanges: allDrift.filter(file => !repairedFiles.has(file)), httpChecks: smoke.checks.length, assetChecks: smoke.assets.length, smokePassed: smoke.passed,
  browserAttempts: fs.existsSync(dir + '/browser.json') ? 1 : 0,
  browserPassed: browser?.passed ?? null,
  browserCategoryChecks: browser?.checks.length ?? 0,
  databaseChanges: false,
};
release.completedAt = new Date().toISOString();
fs.writeFileSync(dir + '/release.json', JSON.stringify(release,null,2));
console.log(JSON.stringify(release.result,null,2));
if (!release.result.bindingMatch || !release.result.compatibilityPreserved || sourceDrift.length || !smoke.passed || (browser && !browser.passed) || deployments[0].versions.length !== 1 || deployments[0].versions[0].version_id !== after.id || deployments[0].versions[0].percentage !== 100) process.exitCode = 1;
