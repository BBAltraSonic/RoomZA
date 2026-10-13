import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const root=process.cwd(),dir=path.join(root,'docs/all-work-deploy-20261009'),record=path.join(dir,'release.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=4096 --dns-result-order=ipv4first',CLOUDFLARE_ACCOUNT_ID:'78269b65c633a2cc3664af5bfd05774d'});
let release;
const save=()=>fs.writeFileSync(record,JSON.stringify(release,null,2));
function linkTree(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(['.cache','.vite'].includes(e.name))continue;const source=path.join(from,e.name),dest=path.join(to,e.name);if(e.isDirectory())linkTree(source,dest);else if(e.isSymbolicLink())throw Error('Unexpected dependency symlink');else fs.linkSync(source,dest);}}
function verify(){for(const [file,h] of Object.entries(release.sourceHashes)){if(hash(fs.readFileSync(path.join(release.snapshot,file)))!==h)throw Error('Snapshot drift: '+file);if(hash(fs.readFileSync(path.join(root,file)))!==h)throw Error('Workspace drift: '+file);}}
async function run(name,command){const start=Date.now(),log=fs.createWriteStream(path.join(dir,name+'.log'));const child=spawn(env.COMSPEC??env.ComSpec??'cmd.exe',['/d','/s','/c',command],{cwd:release.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await new Promise(resolve=>log.end(resolve));
 const latest=JSON.parse(fs.readFileSync(record));for(const key of ['packagingMinification','platformSize'])if(latest[key])release[key]=latest[key];
 release.checks.push({name,command,exitCode:code,seconds:(Date.now()-start)/1000});save();console.log(name+': '+code);if(code!==0)throw Error(name+' failed; inspect retained log');}
if(process.argv[2]==='prepare'){
 if(fs.existsSync(record))throw Error('Release already prepared');
 const prior=JSON.parse(fs.readFileSync('docs/specials-reference-fix-20261009/release.json'));
 const snapshot=path.join(tmpdir(),'pinpoint-all-work-release-'+randomUUID());fs.mkdirSync(snapshot);
 const deployments=JSON.parse(fs.readFileSync('.cache/all-work-deployments-before.json','utf8').replace(/^\uFEFF/,''));const latest=deployments.sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
 release={startedAt:new Date().toISOString(),snapshot,worker:'roomza',origin:'https://roomza.pinpoint-roomza.workers.dev',accountId:env.CLOUDFLARE_ACCOUNT_ID,previousVersion:latest.versions[0].version_id,previousDeployment:latest.id,scope:'All current application work from October 8 and 9; current tracked source plus new source dependencies',sourceHashes:{},checks:[],browserAttempts:0,deployed:false};
 const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);
 for(const file of new Set(files)){
  if(!fs.existsSync(file)||file.startsWith('.env')||file==='scratch_light_transparent.png')continue;
  if(!(file.startsWith('src/')||file.startsWith('public/')||file.startsWith('cloudflare/')||file.startsWith('scripts/')||file.startsWith('supabase/migrations/')||(!file.includes('/')&&!file.endsWith('.log'))))continue;
  if(!fs.statSync(file).isFile())continue;
  const bytes=fs.readFileSync(file),dest=path.join(snapshot,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);release.sourceHashes[file]=hash(bytes);
 }
 if(hash(fs.readFileSync('package-lock.json'))!==hash(fs.readFileSync(path.join(prior.snapshot,'package-lock.json'))))throw Error('Dependency lock differs from verified installation');
 const buildEnv=fs.readFileSync(path.join(prior.snapshot,'.env.production.local'),'utf8');if(buildEnv.split(/\r?\n/).some(line=>line.trim()&&!line.startsWith('NEXT_PUBLIC_')))throw Error('Nonpublic build input');fs.writeFileSync(path.join(snapshot,'.env.production.local'),buildEnv);release.publicBuildEnvHash=hash(buildEnv);
 linkTree(path.join(prior.snapshot,'node_modules'),path.join(snapshot,'node_modules'));release.dependencies='Hardlinks to verified, matching-lock production dependencies; caches excluded';save();verify();console.log(snapshot);
}else{
 release=JSON.parse(fs.readFileSync(record));verify();
 if(process.argv[2]==='build'){
  await run('tests','npx vitest run src/features/discovery src/features/entries src/features/offers src/features/services src/features/guest-contact src/features/listings src/features/map-discovery src/components/navigation src/components/premium src/features/auth src/app/api/discovery --maxWorkers=1');
  await run('typecheck','npm run typecheck');
  await run('lint','npx eslint src/features/discovery src/features/entries src/features/offers src/features/services src/features/guest-contact src/features/listings src/features/map-discovery src/components/navigation src/components/brand-logo.tsx src/components/pinpoint-mark.tsx src/app/api/discovery src/app/api/discovery-media src/app/api/saved-specials');
  await run('audit','npm run audit:prod');
  await run('build','npx opennextjs-cloudflare build');
  await run('minification','node --max-old-space-size=4096 '+path.join(dir,'minify-server.mjs'));release=JSON.parse(fs.readFileSync(record));
  await run('discovery-assets','node scripts/ops/prepare-discovery-assets.mjs');
  await run('size','npm run cf:check:size');verify();release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
 }else if(process.argv[2]==='package'){
  if(!release.checks.some(c=>c.name==='build'&&c.exitCode===0))throw Error('Build incomplete');
  await run('minification','node --max-old-space-size=4096 '+path.join(dir,'minify-server.mjs'));release=JSON.parse(fs.readFileSync(record));
  await run('discovery-assets','node scripts/ops/prepare-discovery-assets.mjs');
  verify();save();
 }else if(process.argv[2]==='finalize'){
  if(!release.checks.some(c=>c.name==='build'&&c.exitCode===0)||!release.checks.some(c=>c.name==='discovery-assets'&&c.exitCode===0))throw Error('Build incomplete');
  await run('current-platform-size','npx wrangler deploy --dry-run --outdir .wrangler/worker-size && node '+path.join(dir,'check-platform-size.mjs'));
  const checked=JSON.parse(fs.readFileSync(record));release.platformSize=checked.platformSize;
  verify();release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
 }else if(process.argv[2]==='deploy'){
  if(!release.readyAt||!release.databaseAppliedAt)throw Error('Build/database gates incomplete');
  const cli=path.join(release.snapshot,'node_modules/wrangler/bin/wrangler.js');
  const current=JSON.parse(execFileSync(process.execPath,[cli,'deployments','list','--json'],{cwd:release.snapshot,env,encoding:'utf8',windowsHide:true})).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];if(current.id!==release.previousDeployment)throw Error('Production changed since baseline');
  if(hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')))!==release.workerSha256)throw Error('Worker drift');
  await run('deploy','npx opennextjs-cloudflare deploy -- --keep-vars --message=all-work-20261008-20261009');
  const after=JSON.parse(execFileSync(process.execPath,[cli,'deployments','list','--json'],{cwd:release.snapshot,env,encoding:'utf8',windowsHide:true})).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));fs.writeFileSync(path.join(dir,'deployments-after.json'),JSON.stringify(after,null,2));release.deployed=true;release.result={deployment:after[0].id,version:after[0].versions[0].version_id,traffic:after[0].versions,deployedAt:new Date().toISOString()};save();console.log(JSON.stringify(release.result));
 }else throw Error('Use prepare, build or deploy');
}
