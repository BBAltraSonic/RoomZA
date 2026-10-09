/** Prepare/build only. This script cannot deploy or migrate a hosted database. */
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const root=process.cwd(), output=path.join(root,'docs/mobile-sheet-deploy-20261008');
const prior=JSON.parse(fs.readFileSync('artifacts/discovery-viewport-20261008/release.json'));
const digest=value=>createHash('sha256').update(value).digest('hex');
const changed=[
  'src/features/admin/components/report-panel.tsx',
  'src/features/map-discovery/discovery-page.tsx',
  'src/features/map-discovery/listing-detail-panel.tsx',
  'src/features/showings/connect-now-sheet.tsx',
];
const added=[];
const manifestPath=path.join(output,'release.json');
let release;
const save=()=>fs.writeFileSync(manifestPath,JSON.stringify(release,null,2)+'\n');
function linkTree(from,to) {
  fs.mkdirSync(to,{recursive:true});
  for(const entry of fs.readdirSync(from,{withFileTypes:true})) {
    if(['.cache','.vite'].includes(entry.name))continue;
    const source=path.join(from,entry.name),destination=path.join(to,entry.name);
    if(entry.isDirectory())linkTree(source,destination);
    else if(entry.isSymbolicLink())throw Error('Unexpected dependency symlink');
    else fs.linkSync(source,destination);
  }
}
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(key.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=1536',CLOUDFLARE_ACCOUNT_ID:prior.accountId});
async function run(name,command) {
  const started=Date.now(),log=fs.createWriteStream(path.join(output,name+'.log'));
  const child=spawn(env.ComSpec??env.COMSPEC??'cmd.exe',['/d','/s','/c',command],{cwd:release.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  await new Promise(resolve=>log.end(resolve));
  release.checks.push({name,command,exitCode,seconds:(Date.now()-started)/1000});save();console.log(name+': '+exitCode);
  if(exitCode!==0)throw Error(name+' failed; inspect retained log');
}
function verify() {
  for(const [file,hash] of Object.entries(release.sourceHashes))if(digest(fs.readFileSync(path.join(release.snapshot,file)))!==hash)throw Error('Snapshot drift: '+file);
  for(const file of [...changed,...added])if(digest(fs.readFileSync(file))!==release.sourceHashes[file])throw Error('Repair source drift: '+file);
}
if(process.argv[2]==='prepare') {
  if(fs.existsSync(manifestPath))throw Error('Retained release already exists');
  const snapshot=path.join(tmpdir(),'pinpoint-mobile-sheet-release-'+randomUUID());fs.mkdirSync(snapshot);
  release={startedAt:new Date().toISOString(),snapshot,baseManifest:'artifacts/discovery-viewport-20261008/release.json',previousVersion:prior.result.version,previousDeployment:prior.result.deployment,worker:prior.worker,origin:prior.origin,accountId:prior.accountId,changedFiles:changed,addedFiles:added,sourceHashes:{},checks:[],browserAttempts:0,hostedDatabaseChanges:false,deployed:false,serverSecretsProvided:false};
  for(const file of new Set([...Object.keys(prior.sourceHashes),...changed,...added])) {
    if(file.startsWith('.env'))continue;
    const source=[...changed,...added].includes(file)?path.join(root,file):path.join(prior.snapshot,file);
    const destination=path.join(snapshot,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);
    release.sourceHashes[file]=digest(fs.readFileSync(destination));
  }
  const buildEnv=fs.readFileSync(path.join(prior.snapshot,'.env.production.local'),'utf8');
  if(buildEnv.split(/\r?\n/).some(line=>line.trim()&&!line.startsWith('NEXT_PUBLIC_')))throw Error('Nonpublic build input');
  fs.writeFileSync(path.join(snapshot,'.env.production.local'),buildEnv);
  release.publicBuildEnvHash=digest(buildEnv);
  release.concurrentUnshippedChanges=Object.entries(release.sourceHashes).filter(([file,hash])=>!fs.existsSync(file)||digest(fs.readFileSync(file))!==hash).map(([file])=>file).filter(file=>![...changed,...added].includes(file));
  linkTree(path.join(prior.snapshot,'node_modules'),path.join(snapshot,'node_modules'));
  release.dependencies='Hardlinks to the locked last-deployed installation; caches excluded';
  save();verify();console.log('Prepared isolated mobile sheet release: '+snapshot);
} else if(process.argv[2]==='build') {
  release=JSON.parse(fs.readFileSync(manifestPath));verify();
  await run('tests','npx vitest run src/features/map-discovery/listing-detail-panel.share.test.tsx src/features/map-discovery/discovery-page.detail-expansion.test.tsx src/features/map-discovery/discovery-page.detail-loader.test.tsx src/features/map-discovery/discovery-page.sheet-persistence.test.tsx src/features/admin/components/report-panel.test.tsx src/features/applications/application-modal.test.tsx --maxWorkers=1');
  await run('typecheck','npm run typecheck');
  await run('lint','npx eslint src/features/map-discovery/discovery-page.tsx src/features/map-discovery/listing-detail-panel.tsx src/features/showings/connect-now-sheet.tsx src/features/admin/components/report-panel.tsx');
  await run('build','npx opennextjs-cloudflare build');
  await run('discovery-assets','node scripts/ops/prepare-discovery-assets.mjs');
  await run('size','npm run cf:check:size');
  verify();release.workerSha256=digest(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
} else throw Error('Use prepare or build. Hosted release requires separate authorization.');
