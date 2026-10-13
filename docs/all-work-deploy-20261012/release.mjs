import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.cwd(), dir = path.dirname(fileURLToPath(import.meta.url));
const record = path.join(dir, 'release.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(key.toUpperCase())));
Object.assign(env, { CI:'1', NEXT_TELEMETRY_DISABLED:'1', NODE_OPTIONS:'--max-old-space-size=4096 --dns-result-order=ipv4first', CLOUDFLARE_ACCOUNT_ID:'78269b65c633a2cc3664af5bfd05774d', WRANGLER_LOG_PATH:path.join(dir,'wrangler.log') });
let release;
const save = () => fs.writeFileSync(record, JSON.stringify(release, null, 2));
function linkTree(from, to) {
  fs.mkdirSync(to, {recursive:true});
  for (const entry of fs.readdirSync(from, {withFileTypes:true})) {
    if (['.cache','.vite'].includes(entry.name)) continue;
    const source = path.join(from,entry.name), destination = path.join(to,entry.name);
    if (entry.isDirectory()) linkTree(source,destination);
    else if (entry.isSymbolicLink()) throw Error('Unexpected dependency symlink');
    else fs.linkSync(source,destination);
  }
}
function verify() {
  for (const [file,sha] of Object.entries(release.sourceHashes)) {
    if (hash(fs.readFileSync(path.join(release.snapshot,file))) !== sha) throw Error('Snapshot drift: '+file);
    if (hash(fs.readFileSync(path.join(root,file))) !== sha) throw Error('Workspace source drift: '+file);
  }
  if (hash(fs.readFileSync(path.join(release.snapshot,'.env.production.local'))) !== release.publicBuildEnvHash) throw Error('Public build-input drift');
}
async function run(name, args) {
  const start = Date.now(), log = fs.createWriteStream(path.join(dir,name+'.log'));
  const child = spawn(process.execPath,args,{cwd:release.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false}); child.stderr.pipe(log,{end:false});
  const code = await new Promise((resolve,reject) => {child.once('error',reject);child.once('close',resolve);});
  await new Promise(resolve => log.end(resolve));
  const updated = readJson(record);
  for (const key of ['packagingMinification','platformSize']) if (updated[key]) release[key] = updated[key];
  release.checks.push({name,args,exitCode:code,seconds:(Date.now()-start)/1000}); save();
  console.log(name+': '+code);
  if (code !== 0) throw Error(name+' failed; inspect retained log');
}
const wrangler = args => execFileSync(process.execPath,[path.join(release.snapshot,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:release.snapshot,env,encoding:'utf8',windowsHide:true});
if (process.argv[2] === 'prepare') {
  if (fs.existsSync(record)) throw Error('Release already prepared');
  const prior = readJson(path.join(root,'docs/national-places-deploy-20261011/release.json'));
  const current = readJson(path.join(dir,'deployments-before.json')).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if (current.versions.length !== 1 || current.versions[0].percentage !== 100 || current.versions[0].version_id !== prior.result.version) throw Error('Production does not match verified baseline');
  const snapshot = path.join(root,'.cache','pinpoint-all-work-release-20261012-'+randomUUID());
  fs.mkdirSync(snapshot);
  release = {startedAt:new Date().toISOString(),snapshot,baselineSnapshot:prior.snapshot,worker:'roomza',origin:prior.origin,accountId:env.CLOUDFLARE_ACCOUNT_ID,previousVersion:current.versions[0].version_id,previousDeployment:current.id,scope:'All completed work since Friday 9 October: preserved Friday release and national catalogue, Google sign-in, Services details, Special galleries',scopeFiles:[],sourceHashes:{},inputHashes:{},checks:[],browserAttempts:0,databaseChanges:['20261011113405_specials_photo_galleries.sql'],deployed:false};
  const inventory = execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{cwd:root,encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);
  const files = new Set(Object.keys(prior.sourceHashes));
  for (const file of inventory) if ((file.startsWith('src/')||file.startsWith('public/')||file.startsWith('scripts/')||file.startsWith('supabase/migrations/'))&&!file.includes('__pycache__')&&!/\.(pyc|log|tmp)$/.test(file)) files.add(file);
  for (const file of [...files].sort()) {
    const source = path.join(root,file);
    if (!fs.existsSync(source)) {
      if (prior.sourceHashes[file]) throw Error('Unexpected missing baseline source: '+file);
      files.delete(file); continue;
    }
    if (prior.sourceHashes[file] && hash(fs.readFileSync(path.join(prior.snapshot,file))) !== prior.sourceHashes[file]) throw Error('Baseline drift: '+file);
    const bytes = fs.readFileSync(source), destination = path.join(snapshot,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
    const sha = hash(bytes);release.sourceHashes[file]=sha;
    if (sha !== prior.sourceHashes[file]) {release.scopeFiles.push(file);release.inputHashes[file]=sha;}
  }
  if (release.sourceHashes['package-lock.json'] !== prior.sourceHashes['package-lock.json']) throw Error('Lockfile differs from verified dependencies');
  const buildEnv = fs.readFileSync(path.join(prior.snapshot,'.env.production.local'),'utf8');
  if (buildEnv.split(/\r?\n/).some(line=>line.trim()&&!line.startsWith('NEXT_PUBLIC_'))) throw Error('Nonpublic build inputs');
  fs.writeFileSync(path.join(snapshot,'.env.production.local'),buildEnv);release.publicBuildEnvHash=hash(buildEnv);
  linkTree(path.join(prior.snapshot,'node_modules'),path.join(snapshot,'node_modules'));
  release.dependencies = 'Same-volume hardlinks to verified Next.js 16.3.8 dependencies with identical lockfile; no runtime credentials in build inputs';
  save();verify();console.log(JSON.stringify({snapshot,sourceFiles:files.size,deltaFiles:release.scopeFiles.length,rollback:release.previousVersion}));
} else {
  release=readJson(record);verify();
  if (process.argv[2] === 'build') {
    const stages = [
      ['tests',['node_modules/vitest/vitest.mjs','run','src/features/discovery','src/features/entries','src/features/offers','src/features/services','src/features/guest-contact','src/features/listings','src/features/map-discovery','src/features/places','src/components/navigation','src/components/premium','src/features/auth','src/app/auth','src/app/services','src/app/api/discovery','src/app/api/private/offers/places','src/lib/supabase','--maxWorkers=2']],
      ['typecheck',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']],
      ['lint',['node_modules/eslint/bin/eslint.js',...release.scopeFiles.filter(file=>/\.(tsx?|mjs)$/.test(file))]],
      ['audit',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'audit','--audit-level=moderate','--omit=dev']],
      ['build',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','build']],
      ['minification',[path.join(dir,'minify-server.mjs')]],
      ['discovery-assets',['scripts/ops/prepare-discovery-assets.mjs']],
      ['size-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--outdir','.wrangler/worker-size']],
      ['current-platform-size',[path.join(dir,'check-platform-size.mjs')]],
    ];
    for(const [name,args] of stages) if (!release.checks.some(check=>check.name===name&&check.exitCode===0)) await run(name,args);
    verify();release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
  } else if (process.argv[2] === 'deploy') {
    if (!release.readyAt || !fs.existsSync(path.join(dir,'database-verified.json'))) throw Error('Build or database verification gates incomplete');
    const current = JSON.parse(wrangler(['deployments','list','--name','roomza','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
    if(current.id!==release.previousDeployment)throw Error('Production changed after baseline capture');
    if(hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')))!==release.workerSha256)throw Error('Worker drift');
    await run('deploy',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','deploy','--','--keep-vars','--message=all-completed-since-friday-20261012']);
    const after=JSON.parse(wrangler(['deployments','list','--name','roomza','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
    fs.writeFileSync(path.join(dir,'deployments-after.json'),JSON.stringify(after.map(({author_email,...item})=>item),null,2));
    release.deployed=true;release.result={deployment:after[0].id,version:after[0].versions[0].version_id,traffic:after[0].versions,deployedAt:new Date().toISOString()};save();console.log(JSON.stringify(release.result));
  } else throw Error('Use prepare, build or deploy');
}
