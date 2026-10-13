import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

const cache = '.cache/national-places';
const added = [
  'supabase/migrations/20261011114646_national_place_catalogue.sql',
  'src/features/places/catalogue-client.ts',
  'src/app/api/private/offers/places/route.test.ts',
  'scripts/db/download-file.mjs', 'scripts/db/export-osm-places.mjs',
  'scripts/db/extract-osm-places.py', 'scripts/db/generate-place-download.mjs',
  'scripts/db/national-places-mappings.json', 'scripts/db/national-places-requirements.txt',
  'scripts/db/national-places.mjs', 'scripts/db/national-places.test.mjs',
  'scripts/db/prepare-place-boundaries.py', 'scripts/db/test-place-extraction.py',
  'scripts/db/verify-national-places.mjs',
  'public/data/south-africa-places.html', 'public/data/south-africa-places.json.gz',
  'public/data/south-africa-places-coverage.json.gz',
  'docs/national-place-autocomplete-20261011.md', 'scripts/ops/package-national-places.mjs',
];
const dependencies = ['src/app/api/discovery/places/route.ts', 'src/app/api/discovery/places/route.test.ts'];
const evidence = ['focused-tests.log', 'regression-tests.log', 'property-catalogue-tests.log',
  'property-regression-final.log', 'importer-tests.log', 'extraction-tests.log',
  'database-final.log', 'sql-verification.json', 'typecheck-final.log', 'lint.log',
  'property-lint.log', 'tooling-lint.log', 'package-lint.log', 'artifact-check.log',
  'build-final.log', 'production-rollback-reference.json'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) result.push(relative);
    else throw new Error('Unexpected non-file baseline entry');
  }
  return result.sort();
}
const modified = await filesUnder(cache + '/before');
if (modified.length !== 17) throw new Error('Expected 17 captured pre-edit files');
const zip = new JSZip(), entries = [], baseline = new Map();
let patch = '';
for (const file of [...modified, ...added]) {
  const bytes = await fs.readFile(file);
  const entry = { path: file, bytes: bytes.length, sha256: sha(bytes), kind: modified.includes(file) ? 'delta' : 'added' };
  zip.file('after/' + file, bytes);
  if (entry.kind === 'delta') {
    const beforePath = cache + '/before/' + file;
    const before = await fs.readFile(beforePath);
    baseline.set(file, before);
    entry.baselineSha256 = sha(before);
    zip.file('before/' + file, before);
    const diff = spawnSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--binary', '--', beforePath, file], { encoding: 'utf8' });
    if (diff.error || ![0, 1].includes(diff.status)) throw diff.error ?? new Error(diff.stderr);
    patch += diff.stdout.replaceAll('a/' + cache + '/before/', 'a/');
  }
  entries.push(entry);
}
// Rehearse only the captured delta, in a newly-created isolated file tree.
const scratch = await fs.mkdtemp(path.resolve(cache) + '/patch-rehearsal-');
for (const [file, bytes] of baseline) {
  await fs.mkdir(path.dirname(path.join(scratch, file)), { recursive: true });
  await fs.writeFile(path.join(scratch, file), bytes);
}
const patchFile = path.resolve(scratch, 'changes.patch');
await fs.writeFile(patchFile, patch);
function apply(args) {
  const result = spawnSync('git', ['-c', 'core.autocrlf=false', 'apply', ...args, '--', patchFile], {
    cwd: scratch, encoding: 'utf8',
    env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(scratch) },
  });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
}
apply(['--check']); apply([]);
for (const entry of entries.filter(e => e.kind === 'delta')) {
  if (sha(await fs.readFile(path.join(scratch, entry.path))) !== entry.sha256) throw new Error('Forward patch byte mismatch: ' + entry.path);
}
apply(['--reverse', '--check']); apply(['--reverse']);
for (const entry of entries.filter(e => e.kind === 'delta')) {
  if (sha(await fs.readFile(path.join(scratch, entry.path))) !== entry.baselineSha256) throw new Error('Rollback byte mismatch: ' + entry.path);
}
zip.file('changes.patch', patch);
const logs = {};
for (const file of evidence) {
  const bytes = await fs.readFile(cache + '/' + file);
  logs[file] = bytes.toString('utf8'); zip.file('evidence/' + file, bytes);
}
for (const file of ['focused-tests.log', 'regression-tests.log', 'property-catalogue-tests.log', 'property-regression-final.log']) {
  if (!/Tests\s+\d+ passed/.test(logs[file]) || /\d+ failed/.test(logs[file])) throw new Error('Test evidence failed: ' + file);
}
for (const file of ['typecheck-final.log', 'lint.log', 'property-lint.log', 'tooling-lint.log', 'package-lint.log']) {
  if (logs[file].trim()) throw new Error('Check evidence nonempty: ' + file);
}
if (!logs['build-final.log'].includes('Initial client JS budget passed') || !logs['build-final.log'].includes('First-load client JS budget passed')) throw new Error('Final build evidence missing');
if (!logs['extraction-tests.log'].includes('OK') || !/pass 5/.test(logs['importer-tests.log'])) throw new Error('Importer/extraction checks missing');
const sql = JSON.parse(logs['sql-verification.json']);
if (sql.checks !== 69 || !sql.fixture_checks_passed || sql.rerun.inserted !== 0 || sql.import.inserted !== 18248 || sql.import.linked !== 4) throw new Error('Database proof incomplete');
for (const file of ['manifest.json', 'coverage.json', 'snapshot.json', 'legacy-places.json']) zip.file('catalogue/' + file, await fs.readFile(cache + '/' + file));
const dependencyEntries = [];
for (const file of dependencies) {
  const bytes = await fs.readFile(file); zip.file('dependency-reference/' + file, bytes);
  dependencyEntries.push({ path: file, sha256: sha(bytes) });
}
const manifest = {
  createdAt: new Date().toISOString(), kind: 'scoped-source-handoff', deployed: false,
  productionMigrationApplied: false, browserVerified: false, workersBuildVerified: false,
  records: 18252, provinceCount: 9, databaseChecks: 69,
  patchRehearsal: { forward: 'byte-identical', reverse: 'byte-identical', workingCheckoutModified: false },
  instructions: 'Apply changes.patch and added files to an isolated reconciled source baseline. Before/after snapshots contain prior local work: do not blindly deploy them or the dirty checkout. Database/hosted/Workers/browser release gates and deployment remain separate.',
  rollback: { workerVersion: 'fab86d64-a92f-4f2d-8a32-dccf48f2fa3a', recheckBeforeRelease: true, keepImportedIdsAndMetadata: true },
  dependencyEntries, entries,
};
zip.file('manifest.json', JSON.stringify(manifest, null, 2));
for (const entry of entries) if (sha(await fs.readFile(entry.path)) !== entry.sha256) throw new Error('Source drift during packaging: ' + entry.path);
const directory = 'artifacts/national-places'; await fs.mkdir(directory, { recursive: true });
const output = path.resolve(directory, 'national-places-20261011.zip');
await fs.writeFile(output, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
await fs.writeFile(output + '.manifest.json', JSON.stringify(manifest, null, 2));
await fs.writeFile(output + '.patch', patch);
console.log(JSON.stringify({ output, sha256: sha(await fs.readFile(output)), bytes: (await fs.stat(output)).size, sourceFiles: entries.length, patchRehearsal: manifest.patchRehearsal }));
