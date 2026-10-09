/** Phase 1 inventory only. No schema, data, container, config or secret writes. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const mode = process.argv[2];
assert.ok(['capture', 'verify'].includes(mode), 'Use capture or verify');
const root = resolve('.');
assert.equal(root.toLowerCase(), 'c:\\users\\bb\\documents\\roomza');
const baselinePath = 'docs/pinpoint-phase5-baseline-2026-10-06.json';
const verificationPath = 'docs/pinpoint-phase5-preservation-2026-10-06.json';
const ownedPaths = JSON.parse(readFileSync('docs/pinpoint-phase5-owned-paths-2026-10-06.json','utf8'));
const isOwned = path => ownedPaths.some(owned => path === owned || path.startsWith(owned+'/'));
const hash = value => createHash('sha256').update(value).digest('hex');
function command(binary, args, input) {
  try {
    return execFileSync(binary, args, { input, encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }).trimEnd();
  } catch {
    throw new Error(`${binary} read-only inventory failed; private output withheld`);
  }
}
const git = args => command('git', args);
const docker = args => command('docker', args);
function sql(query) {
  return JSON.parse(command('docker', ['exec', '-i', 'supabase_db_roomza',
    'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-At',
    '-v', 'ON_ERROR_STOP=1'],
  `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='20s';\n${query}\nCOMMIT;`));
}
const normalize = value => value.replace(/\r\n/g, '\n').trim();
function capture() {
  const paths = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0').filter(Boolean))].sort();
  const sourceHashes = Object.fromEntries(paths.filter(path => existsSync(path))
    .map(path => [path, hash(readFileSync(path))]));
  const local = parseEnv(readFileSync('.env.local', 'utf8'));
  assert.equal(local.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:54321', 'Local URL guard');
  const names = docker(['ps', '--format', '{{.Names}}']).split(/\r?\n/)
    .filter(name => /^supabase_.*_roomza$/.test(name)).sort();
  const containers = names.map(name => {
    const c = JSON.parse(docker(['inspect', name]))[0];
    return { name, id: c.Id, image: c.Config.Image,
      configurationSha256: hash(JSON.stringify({config:c.Config,host:c.HostConfig,mounts:c.Mounts})),
      ...(name === 'supabase_auth_roomza' ? { totpEnrollmentEnabled:
        c.Config.Env.includes('GOTRUE_MFA_TOTP_ENROLL_ENABLED=true'),
        totpVerificationEnabled:c.Config.Env.includes('GOTRUE_MFA_TOTP_VERIFY_ENABLED=true') } : {}) };
  });
  assert.equal(containers.find(c => c.name === 'supabase_db_roomza')?.image,
    'public.ecr.aws/supabase/postgres:17.6.1.111');
  const tables = sql("select coalesce(json_agg(tablename order by tablename),'[]') from pg_tables where schemaname='public';");
  assert.ok(tables.every(table => /^[a-z_]+$/.test(table)));
  const tableQueries = tables.map(table => `select 'public.${table}' as name,count(*) as count,
    md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')) as fingerprint from public.${table} t`);
  for (const table of ['auth.users','auth.sessions','auth.mfa_factors','storage.objects','storage.buckets']) {
    tableQueries.push(`select '${table}' as name,count(*) as count,
      md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')) as fingerprint from ${table} t`);
  }
  const data = sql(`select json_agg(row_to_json(t) order by name) from (${tableQueries.join(' union all ')}) t;`);
  const runtime = sql("select coalesce(json_agg(row_to_json(m) order by version),'[]') from supabase_migrations.schema_migrations m;");
  const migrations = paths.filter(path => /^supabase\/migrations\/\d+_.*\.sql$/.test(path)).map(path => {
    const source = readFileSync(path, 'utf8'), version = path.split('/').at(-1).split('_')[0];
    const applied = runtime.find(m => m.version === version);
    const statements = applied?.statements?.join('\n');
    return { path, version, sourceSha256:hash(source), sharedLocalApplied:!!applied,
      runtimeName:applied?.name ?? null, runtimeStatementsSha256: statements === undefined ? null : hash(statements),
      sourceMatchesRuntimeExactly:statements === undefined ? null : source === statements,
      sourceMatchesRuntimeNormalized:statements === undefined ? null : normalize(source) === normalize(statements) };
  });
  const catalogue = sql(`select json_build_object(
    'functions', (select md5(coalesce(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||coalesce(p.proconfig::text,''),E'\\n' order by n.nspname,p.proname,p.oid),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'),
    'tableSecurity',(select md5(coalesce(string_agg(c.oid::text||c.relrowsecurity::text||c.relforcerowsecurity::text||coalesce(c.relacl::text,''),E'\\n' order by c.oid),'')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','storage') and c.relkind in ('r','v','p')),
    'policies',(select md5(coalesce(string_agg(row_to_json(p)::text,E'\\n' order by row_to_json(p)::text),'')) from pg_policies p where schemaname in ('public','private','storage')),
    'schedules',(select md5(coalesce(string_agg(row_to_json(j)::text,E'\\n' order by jobid),'')) from cron.job j),
    'scheduleCount',(select count(*) from cron.job));`);
  return { recordedAt:new Date().toISOString(), environment:'source and read-only existing shared local; no application journeys',
    checkout:{root,branch:git(['branch','--show-current']),head:git(['rev-parse','HEAD'])},
    phase1OwnedPaths:ownedPaths, worktreeStatus:git(['status','--short','--untracked-files=all']).split(/\r?\n/),
    sourceHashes, environmentConfiguration:{supabaseLoopbackOnly:true,
      developmentMapTilerKeyPresent:!!local.NEXT_PUBLIC_MAPTILER_API_KEY,
      productionEnvRead:false, localEnvSha256:hash(readFileSync('.env.local')),
      supabaseConfigSha256:hash(readFileSync('supabase/config.toml')),
      node:command('node',['--version']), next:JSON.parse(readFileSync('node_modules/next/package.json','utf8')).version},
    containers, data, catalogue, migrations,
    runtimeMigrationCount:runtime.length,
    runtimeMigrationHistorySha256:hash(JSON.stringify(runtime)),
    runtimeOnlyVersions:runtime.filter(m => !migrations.some(s => s.version === m.version)).map(m => m.version),
    fixturesCreated:false, mutationsPerformed:false };
}
if (mode === 'capture') {
  assert.ok(!existsSync(baselinePath), 'Existing baseline must not be overwritten');
  const baseline = capture();
  writeFileSync(baselinePath, JSON.stringify(baseline,null,2)+'\n');
  console.log(JSON.stringify({baselinePath, files:Object.keys(baseline.sourceHashes).length,
    sourceMigrations:baseline.migrations.length, runtimeMigrations:baseline.runtimeMigrationCount,
    pendingMigrations:baseline.migrations.filter(m=>!m.sharedLocalApplied).map(m=>m.path),
    normalizedMismatches:baseline.migrations.filter(m=>m.sourceMatchesRuntimeNormalized===false).map(m=>m.path)}));
} else {
  const before = JSON.parse(readFileSync(baselinePath,'utf8')), after = capture();
  const changedPreservedPaths = Object.keys(before.sourceHashes).filter(path =>
    !isOwned(path) && before.sourceHashes[path] !== after.sourceHashes[path]);
  const unexpectedNewPaths = Object.keys(after.sourceHashes).filter(path =>
    !isOwned(path) && !(path in before.sourceHashes));
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const checks = { checkoutUnchanged:equal(before.checkout,after.checkout),
    preservedFilesUnchanged:changedPreservedPaths.length===0,
    noUnexpectedNewFiles:unexpectedNewPaths.length===0,
    sharedDataCountsAndFingerprintsUnchanged:equal(before.data,after.data),
    migrationHistoryUnchanged:before.runtimeMigrationHistorySha256===after.runtimeMigrationHistorySha256,
    sourceMigrationsUnchanged:equal(before.migrations,after.migrations),
    containersAndConfigurationUnchanged:equal(before.containers,after.containers),
    functionsPoliciesGrantsSchedulesUnchanged:equal(before.catalogue,after.catalogue),
    localEnvAndSupabaseConfigUnchanged:equal(before.environmentConfiguration,after.environmentConfiguration) };
  const result = {recordedAt:new Date().toISOString(),baselinePath,
    sharedDataDifferences:after.data.filter(row=>!equal(row,before.data.find(prior=>prior.name===row.name)))
      .map(row=>({table:row.name,before:before.data.find(prior=>prior.name===row.name),after:row})),
    baselineSha256:hash(readFileSync(baselinePath)), checks, changedPreservedPaths,unexpectedNewPaths,
    preservedFileCount:Object.keys(before.sourceHashes).filter(path=>!ownedPaths.includes(path)).length,
    phase5OwnedHashes:Object.fromEntries(ownedPaths.filter(path=>path!==verificationPath&&existsSync(path)&&statSync(path).isFile()).map(path=>[path,hash(readFileSync(path))])),
    sharedAfter: {data:after.data,catalogue:after.catalogue,containers:after.containers,
      runtimeMigrationCount:after.runtimeMigrationCount,runtimeMigrationHistorySha256:after.runtimeMigrationHistorySha256},
    priorEvidenceSourceComparison: [
      'pinpoint-property-save-browser-complete-evidence.json', 'pinpoint-b1-browser-local-evidence.json',
      'pinpoint-offer-screen-local-evidence.json', 'pinpoint-offer-review-screen-local-evidence.json',
      'pinpoint-offer-permission-local-evidence.json', 'pinpoint-offer-permission-review-local-evidence.json',
      'pinpoint-offer-location-review-local-evidence.json', 'pinpoint-offer-decisions-local-evidence.json',
      'pinpoint-offer-public-local-evidence.json', 'pinpoint-offer-public-http-local-evidence.json',
      'pinpoint-offer-feed-screen-local-evidence.json', 'pinpoint-offer-report-local-evidence.json',
      'pinpoint-entry-intake-complete-evidence.json', 'pinpoint-entry-corrections-complete-evidence.json',
      'pinpoint-services-local-evidence.json'
    ].map(name => {
      const path = 'docs/'+name, evidence = JSON.parse(readFileSync(path,'utf8'));
      const entries = Object.entries(evidence.sourceHashes ?? {});
      return {path,recordedAt:evidence.recordedAt ?? null,environment:evidence.environment,
        recordedPassed:evidence.passed ?? null,
        matchingSourceHashes:entries.filter(([p,h])=>after.sourceHashes[p]===h).length,
        changedPaths:entries.filter(([p,h])=>after.sourceHashes[p]!==undefined&&after.sourceHashes[p]!==h).map(([p])=>p),
        unavailablePaths:entries.filter(([p])=>after.sourceHashes[p]===undefined).map(([p])=>p)};
    }),
    fixturesCreated:false, mutationsPerformed:false, passed:Object.values(checks).every(Boolean)};
  writeFileSync(verificationPath,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({verificationPath,checks,changedPreservedPaths,unexpectedNewPaths,passed:result.passed}));
  assert.ok(result.passed, 'Preservation comparison failed; inspect evidence');
}

