import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=process.cwd(), dir=path.dirname(fileURLToPath(import.meta.url)), record=path.join(dir,'release.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const scope=[
 'src/components/premium/discovery-card.tsx',
 'src/features/discovery/discovery-shell.tsx',
 'src/features/discovery/viewport-discovery-screen.tsx',
 'src/features/services/data.ts', 'src/features/services/schema.ts',
 'src/features/services/service-feed-card.tsx',
 'src/app/services/services-discovery.tsx', 'src/app/services/services-discovery.test.tsx',
 'src/app/api/services/[id]/route.ts',
 'src/features/services/service-details.tsx',
 'src/features/services/use-service-detail.ts',
 'src/features/services/service-detail-content.tsx',
 'src/features/services/service-details.test.tsx',
 'src/features/services/public-service.test.ts',
 'src/features/services/service-discovery-details.test.tsx',
];
const tests=[
 'src/features/services/service-details.test.tsx', 'src/features/services/public-service.test.ts',
 'src/features/services/service-discovery-details.test.tsx', 'src/features/discovery/feed-cards.test.tsx',
 'src/features/discovery/viewport-discovery-screen.test.tsx', 'src/features/discovery/special-details.test.tsx',
 'src/app/services/services-discovery.test.tsx', 'src/features/discovery/deal-schema.test.ts',
];
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=4096 --dns-result-order=ipv4first',CLOUDFLARE_ACCOUNT_ID:'78269b65c633a2cc3664af5bfd05774d'});
let release;
const save=()=>fs.writeFileSync(record,JSON.stringify(release,null,2));
function linkTree(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(['.cache','.vite'].includes(e.name))continue;const source=path.join(from,e.name),dest=path.join(to,e.name);if(e.isDirectory())linkTree(source,dest);else if(e.isSymbolicLink())throw Error('Unexpected dependency symlink');else fs.linkSync(source,dest);}}
function verify(){for(const [file,h] of Object.entries(release.sourceHashes))if(hash(fs.readFileSync(path.join(release.snapshot,file)))!==h)throw Error('Snapshot drift: '+file);for(const [file,h] of Object.entries(release.inputHashes))if(hash(fs.readFileSync(path.join(root,file)))!==h)throw Error('Scoped workspace drift: '+file);if(hash(fs.readFileSync(path.join(release.snapshot,'.env.production.local')))!==release.publicBuildEnvHash)throw Error('Build input drift');}
async function run(name,args){const start=Date.now(),log=fs.createWriteStream(path.join(dir,name+'.log'));const child=spawn(process.execPath,args,{cwd:release.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await new Promise(resolve=>log.end(resolve));const latest=readJson(record);if(latest.packagingMinification)release.packagingMinification=latest.packagingMinification;release.checks.push({name,args,exitCode:code,seconds:(Date.now()-start)/1000});save();console.log(name+': '+code);if(code!==0)throw Error(name+' failed; inspect retained log');}
const wrangler=args=>execFileSync(process.execPath,[path.join(release.snapshot,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:release.snapshot,env,encoding:'utf8',windowsHide:true});
if(process.argv[2]==='prepare'){
 if(fs.existsSync(record))throw Error('Release already prepared');
 const prior=readJson(path.join(root,'docs/all-work-deploy-20261009/release.json'));
 const current=readJson(path.join(dir,'deployments-before.json')).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
 if(current.versions.length!==1||current.versions[0].percentage!==100||current.versions[0].version_id!==prior.result.version)throw Error('Retained baseline differs from production');
 const snapshot=path.join(tmpdir(),'pinpoint-service-details-release-'+randomUUID());fs.mkdirSync(snapshot);
 release={startedAt:new Date().toISOString(),snapshot,baselineSnapshot:prior.snapshot,worker:'roomza',origin:prior.origin,accountId:env.CLOUDFLARE_ACCOUNT_ID,previousVersion:current.versions[0].version_id,previousDeployment:current.id,scope:'Service card details, approved-only detail API, query navigation and focused tests',scopeFiles:scope,sourceHashes:{},inputHashes:{},checks:[],browserAttempts:0,databaseChanges:false,deployed:false};
 for(const [file,h] of Object.entries(prior.sourceHashes)){const bytes=fs.readFileSync(path.join(prior.snapshot,file));if(hash(bytes)!==h)throw Error('Baseline drift: '+file);const dest=path.join(snapshot,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);release.sourceHashes[file]=h;}
 for(const file of scope){const bytes=fs.readFileSync(path.join(root,file)),dest=path.join(snapshot,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);release.sourceHashes[file]=release.inputHashes[file]=hash(bytes);}
 if(hash(fs.readFileSync(path.join(root,'package-lock.json')))!==prior.sourceHashes['package-lock.json'])throw Error('Dependency lock changed');
 const buildEnv=fs.readFileSync(path.join(prior.snapshot,'.env.production.local'),'utf8');if(buildEnv.split(/\r?\n/).some(line=>line.trim()&&!line.startsWith('NEXT_PUBLIC_')))throw Error('Nonpublic build input');fs.writeFileSync(path.join(snapshot,'.env.production.local'),buildEnv);release.publicBuildEnvHash=hash(buildEnv);
 linkTree(path.join(prior.snapshot,'node_modules'),path.join(snapshot,'node_modules'));release.dependencies='Same-volume hardlinks to verified matching-lock production dependencies; caches excluded';release.preservation='All baseline source hashes preserved except the 15 reviewed service-details files. Concurrent Specials galleries, catalogue migrations and other dirty work excluded.';save();verify();console.log(snapshot);
}else{
 release=readJson(record);verify();
 if(process.argv[2]==='build'){
  await run('tests',['node_modules/vitest/vitest.mjs','run',...tests,'--maxWorkers=2']);
  await run('typecheck',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']);
  await run('lint',['node_modules/eslint/bin/eslint.js',...scope]);
  await run('audit',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'audit','--audit-level=moderate','--omit=dev']);
  await run('build',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','build']);
  await run('minification',[path.join(dir,'minify-server.mjs')]);
  await run('discovery-assets',['scripts/ops/prepare-discovery-assets.mjs']);
  await run('size-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--outdir','.wrangler/worker-size']);
  await run('size',['scripts/ops/check-cloudflare-worker-size.mjs']);
  verify();release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
 }else if(process.argv[2]==='deploy'){
  if(!release.readyAt)throw Error('Build gates incomplete');
  const current=JSON.parse(wrangler(['deployments','list','--name','roomza','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];if(current.id!==release.previousDeployment)throw Error('Production changed since baseline');
  if(hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')))!==release.workerSha256)throw Error('Worker drift');
  await run('deploy',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','deploy','--','--keep-vars','--message=service-details-20261011']);
  const after=JSON.parse(wrangler(['deployments','list','--name','roomza','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));fs.writeFileSync(path.join(dir,'deployments-after.json'),JSON.stringify(after,null,2));release.deployed=true;release.result={deployment:after[0].id,version:after[0].versions[0].version_id,traffic:after[0].versions,deployedAt:new Date().toISOString()};save();console.log(JSON.stringify(release.result));
 }else throw Error('Use prepare, build or deploy');
}
