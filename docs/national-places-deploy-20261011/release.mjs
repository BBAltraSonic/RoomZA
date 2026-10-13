import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=process.cwd(), dir=path.dirname(fileURLToPath(import.meta.url)), record=path.join(dir,'release.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const scope=["src/app/api/offers/places/route.ts","src/app/api/private/offers/places/route.ts","src/features/map-discovery/discovery-page.consistency.test.tsx","src/features/map-discovery/discovery-page.filters-url.test.tsx","src/features/map-discovery/discovery-page.tsx","src/features/map-discovery/location-selector.test.tsx","src/features/map-discovery/location-selector.tsx","src/features/map-discovery/search-suggestions.test.ts","src/features/map-discovery/search-suggestions.tsx","src/features/offers/public-place-contract.ts","src/features/offers/public-place-data.ts","src/features/places/catalogue-contract.ts","src/features/places/catalogue.test.ts","src/features/places/catalogue.ts","src/features/places/place.ts","src/features/places/server.test.ts","src/features/places/server.ts","supabase/migrations/20261011114646_national_place_catalogue.sql","src/features/places/catalogue-client.ts","src/app/api/private/offers/places/route.test.ts","scripts/db/download-file.mjs","scripts/db/export-osm-places.mjs","scripts/db/extract-osm-places.py","scripts/db/generate-place-download.mjs","scripts/db/national-places-mappings.json","scripts/db/national-places-requirements.txt","scripts/db/national-places.mjs","scripts/db/national-places.test.mjs","scripts/db/prepare-place-boundaries.py","scripts/db/test-place-extraction.py","scripts/db/verify-national-places.mjs","public/data/south-africa-places.html","public/data/south-africa-places.json.gz","public/data/south-africa-places-coverage.json.gz","docs/national-place-autocomplete-20261011.md","scripts/ops/package-national-places.mjs"];
const tests=["src/features/places/catalogue.test.ts","src/features/places/server.test.ts","src/features/map-discovery/location-selector.test.tsx","src/app/api/discovery/places/route.test.ts","src/app/api/private/offers/places/route.test.ts","src/features/map-discovery/discovery-page.filters-url.test.tsx","src/features/map-discovery/discovery-page.consistency.test.tsx","src/features/map-discovery/search-suggestions.test.ts","src/features/map-discovery/discovery-page.request-manager.test.tsx","src/features/map-discovery/discovery-page.detail-loader.test.tsx","src/features/map-discovery/discovery-page.sheet-persistence.test.tsx"];
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
 const snapshot=path.join(root,'.cache','pinpoint-national-places-release-'+randomUUID());fs.mkdirSync(snapshot);
 release={startedAt:new Date().toISOString(),snapshot,baselineSnapshot:prior.snapshot,worker:'roomza',origin:prior.origin,accountId:env.CLOUDFLARE_ACCOUNT_ID,previousVersion:current.versions[0].version_id,previousDeployment:current.id,scope:'Nationwide South African place catalogue, shared autocomplete and focused tests',scopeFiles:scope,sourceHashes:{},inputHashes:{},checks:[],browserAttempts:0,databaseChanges:true,deployed:false};
 for(const [file,h] of Object.entries(prior.sourceHashes)){const bytes=fs.readFileSync(path.join(prior.snapshot,file));if(hash(bytes)!==h)throw Error('Baseline drift: '+file);const dest=path.join(snapshot,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);release.sourceHashes[file]=h;}
 const manifest=readJson(path.join(root,'artifacts/national-places/national-places-20261011.zip.manifest.json'));
 for(const entry of manifest.entries){
  if(entry.kind==='delta'&&release.sourceHashes[entry.path]!==entry.baselineSha256)throw Error('Production baseline mismatch: '+entry.path);
  if(hash(fs.readFileSync(path.join(root,entry.path)))!==entry.sha256)throw Error('Package source mismatch: '+entry.path);
 }
 for(const file of scope){const bytes=fs.readFileSync(path.join(root,file)),dest=path.join(snapshot,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);release.sourceHashes[file]=release.inputHashes[file]=hash(bytes);}
 if(hash(fs.readFileSync(path.join(root,'package-lock.json')))!==prior.sourceHashes['package-lock.json'])throw Error('Dependency lock changed');
 const buildEnv=fs.readFileSync(path.join(prior.snapshot,'.env.production.local'),'utf8');if(buildEnv.split(/\r?\n/).some(line=>line.trim()&&!line.startsWith('NEXT_PUBLIC_')))throw Error('Nonpublic build input');fs.writeFileSync(path.join(snapshot,'.env.production.local'),buildEnv);release.publicBuildEnvHash=hash(buildEnv);
 linkTree(path.join(prior.snapshot,'node_modules'),path.join(snapshot,'node_modules'));release.dependencies='Same-volume hardlinks to verified matching-lock production dependencies; caches excluded';release.preservation='Baseline source preserved except 17 catalogue delta files and 19 new scoped files. Unrelated Auth, Services, galleries and dirty work excluded.';save();verify();console.log(snapshot);
}else{
 release=readJson(record);verify();
 if(process.argv[2]==='build'){
  await run('tests',['node_modules/vitest/vitest.mjs','run',...tests,'--maxWorkers=2']);
  await run('typecheck',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']);
  await run('lint',['node_modules/eslint/bin/eslint.js',...scope.filter(file=>/\.(tsx?|mjs)$/.test(file))]);
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
  await run('deploy',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','deploy','--','--keep-vars','--message=national-places-20261011']);
  const after=JSON.parse(wrangler(['deployments','list','--name','roomza','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));fs.writeFileSync(path.join(dir,'deployments-after.json'),JSON.stringify(after.map(({author_email,...item})=>item),null,2));release.deployed=true;release.result={deployment:after[0].id,version:after[0].versions[0].version_id,traffic:after[0].versions,deployedAt:new Date().toISOString()};save();console.log(JSON.stringify(release.result));
 }else throw Error('Use prepare, build or deploy');
}
