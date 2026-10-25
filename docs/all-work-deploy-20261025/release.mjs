import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=process.cwd(), dir=path.dirname(fileURLToPath(import.meta.url)), record=path.join(dir,'release.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=6144 --dns-result-order=ipv4first',CLOUDFLARE_ACCOUNT_ID:'78269b65c633a2cc3664af5bfd05774d',WRANGLER_LOG_PATH:path.join(root,'.cache/release-20261025-wrangler.log')});
let r;
const save=()=>fs.writeFileSync(record,JSON.stringify(r,null,2));
function linkTree(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(['.cache','.vite'].includes(e.name))continue;const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())linkTree(a,b);else if(e.isSymbolicLink())fs.cpSync(a,b,{dereference:true,recursive:true});else fs.linkSync(a,b);}}
function verify(){const drift=[];for(const [f,h]of Object.entries(r.sourceHashes)){if(hash(fs.readFileSync(path.join(r.snapshot,f)))!==h)throw Error('Snapshot drift: '+f);if(!fs.existsSync(path.join(root,f))||hash(fs.readFileSync(path.join(root,f)))!==h)drift.push(f);}if(drift.length)throw Error('Workspace source drift: '+drift.join(', '));return true;}
async function run(name,args,extraEnv={},allowFailure=false){const start=Date.now(),log=fs.createWriteStream(path.join(dir,name+'.log'));const p=spawn(process.execPath,args,{cwd:r.snapshot,env:{...env,...extraEnv},windowsHide:true,stdio:['ignore','pipe','pipe']});p.stdout.pipe(log,{end:false});p.stderr.pipe(log,{end:false});const code=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('close',resolve);});await new Promise(resolve=>log.end(resolve));r={...r,...read(record)};r.checks.push({name,exitCode:code,seconds:(Date.now()-start)/1000});save();console.log(name+': '+code);if(code&&!allowFailure)throw Error(name+' failed');}
const mode=process.argv[2];
if(mode==='prepare'){
 if(fs.existsSync(record))throw Error('Already prepared');
 const snapshot=path.join(root,'.cache/all-work-release-20261025');if(fs.existsSync(snapshot))throw Error('Snapshot already exists');fs.mkdirSync(snapshot,{recursive:true});
 r={startedAt:new Date().toISOString(),snapshot,origin:'https://roomza.pinpoint-roomza.workers.dev',accountId:env.CLOUDFLARE_ACCOUNT_ID,scope:'All pending work and all 19 migrations, including the application-document access-control repair, authorized 25 October 2026',sourceHashes:{},checks:[],deployed:false};
 const files=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8',maxBuffer:30e6,windowsHide:true}).split('\0').filter(Boolean))].filter(f=>!f.startsWith('docs/all-work-deploy-20261025/')&&f!=='build.log');
 for(const f of files){if(!fs.existsSync(f)||!fs.statSync(f).isFile())continue;const out=path.join(snapshot,f);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(f,out);if(/^(src|scripts|supabase|workers|cloudflare|public)\//.test(f)||!f.includes('/'))r.sourceHashes[f]=hash(fs.readFileSync(f));}
 const publicEnv=fs.readFileSync('.env.production.local','utf8').split(/\r?\n/).filter(l=>l.startsWith('NEXT_PUBLIC_')).join('\n')+'\n';
 if(!publicEnv.includes('https://qleeedwnnfvmfjjymoco.supabase.co'))throw Error('Wrong build project');
 fs.writeFileSync(path.join(snapshot,'.env.production.local'),publicEnv);r.publicBuildEnvHash=hash(publicEnv);save();
 fs.cpSync(path.join(root,'supabase/.temp'),path.join(snapshot,'supabase/.temp'),{recursive:true});
 linkTree(path.join(root,'node_modules'),path.join(snapshot,'node_modules'));verify();console.log(JSON.stringify({snapshot,sourceFiles:Object.keys(r.sourceHashes).length}));
}else{
 r=read(record);verify();
 if(mode==='checks'){
  await run('tests',['node_modules/vitest/vitest.mjs','run','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+path.join(root,'.cache/release-20261025-tests.json')],{},true);
  await run('worker-tests',['node_modules/vitest/vitest.mjs','run','--config','vitest.notifications-worker.config.ts']);
  await run('typecheck',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']);
  await run('worker-typecheck',['node_modules/typescript/bin/tsc','--project','workers/notifications/tsconfig.json','--noEmit']);
  const changed=[...new Set(execFileSync('git',['ls-files','-mo','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true}).split('\0').filter(f=>/^(src|scripts|cloudflare|workers)\//.test(f)&&/\.(tsx?|mjs)$/.test(f)&&fs.existsSync(path.join(r.snapshot,f))&&!f.startsWith('workers/import-images/')))];
  await run('lint',['node_modules/eslint/bin/eslint.js',...changed]);
  await run('audit',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'audit','--audit-level=moderate','--omit=dev']);
 }else if(mode==='build'){
  await run('copy-maplibre',['scripts/ops/copy-maplibre-worker.mjs']);
  await run('build',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','build']);
  await run('minification',[path.join(dir,'minify-server.mjs')]);
  await run('discovery-assets',['scripts/ops/prepare-discovery-assets.mjs']);
  await run('size-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--outdir','.wrangler/worker-size']);
  await run('platform-size',[path.join(dir,'check-platform-size.mjs')]);
  await run('discovery-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--config','workers/discovery-api/wrangler.jsonc','--dry-run','--outdir','.wrangler/discovery-api-size']);
  await run('notification-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--config','workers/notifications/wrangler.jsonc','--dry-run','--outdir','.wrangler/notifications-size']);
  verify();r.readyAt=new Date().toISOString();save();
 }else if(mode==='rehearsal'){
  await run('database-rehearsal',['scripts/db/unified-marketplace-clone.local.mjs'],{PINPOINT_RELEASE_CLONE_LOCAL:'1',PINPOINT_FLOW_CHECK:'property',PINPOINT_FLOW_CASE:'all'});
 }else if(mode==='migration-dry-run'||mode==='migration-apply'){
  if(mode==='migration-apply'&&!r.migrationsApproved)throw Error('Migration gates incomplete');
  await run(mode,['node_modules/supabase/dist/supabase.js','db','push','--linked','--include-all',...(mode==='migration-dry-run'?['--dry-run']:['--yes'])]);
 }else if(mode==='deploy'){
  if(!r.readyAt||!r.validationApproved||!fs.existsSync(path.join(dir,'database-verified.json')))throw Error('Incomplete release gates');
  await run('discovery-deploy',['node_modules/wrangler/bin/wrangler.js','deploy','--config','workers/discovery-api/wrangler.jsonc','--keep-vars','--message=all-work-20261025']);
  await run('deploy',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','deploy','--','--keep-vars','--message=all-work-20261025']);
  // Notification source is unchanged; its existing deployment and secrets are retained.
  r.deployed=true;save();
 }else if(mode==='verify'){verify();console.log('Source hashes match the isolated release');}
 else throw Error('Unknown release mode');
}
