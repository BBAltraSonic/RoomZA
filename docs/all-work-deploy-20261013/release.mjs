import fs from 'node:fs';
import path from 'node:path';
import {createHash,createECDH,randomBytes,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url)),record=path.join(dir,'release.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
let r;
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=6144 --dns-result-order=ipv4first',CLOUDFLARE_ACCOUNT_ID:'78269b65c633a2cc3664af5bfd05774d',WRANGLER_LOG_PATH:path.join(dir,'wrangler.log')});
const save=()=>fs.writeFileSync(record,JSON.stringify(r,null,2));
function linkTree(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(['.cache','.vite'].includes(e.name))continue;const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())linkTree(a,b);else if(e.isSymbolicLink())throw Error('Unexpected dependency symlink: '+a);else fs.linkSync(a,b);}}
function verify(){for(const [f,h]of Object.entries(r.sourceHashes)){if(hash(fs.readFileSync(path.join(root,f)))!==h||hash(fs.readFileSync(path.join(r.snapshot,f)))!==h)throw Error('Source drift: '+f);}if(hash(fs.readFileSync(path.join(r.snapshot,'.env.production.local')))!==r.publicBuildEnvHash)throw Error('Build input drift');}
async function run(name,args,allowFailure=false){const start=Date.now(),log=fs.createWriteStream(path.join(dir,name+'.log'));const p=spawn(process.execPath,args,{cwd:r.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});p.stdout.pipe(log,{end:false});p.stderr.pipe(log,{end:false});const code=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('close',resolve);});await new Promise(resolve=>log.end(resolve));r={...r,...read(record)};r.checks.push({name,exitCode:code,seconds:(Date.now()-start)/1000});save();console.log(name+': '+code);if(code&&!allowFailure)throw Error(name+' failed');}
const wrangler=args=>execFileSync(process.execPath,[path.join(r.snapshot,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:r.snapshot,env,encoding:'utf8',windowsHide:true});
if(process.argv[2]==='prepare'){
 if(fs.existsSync(record))throw Error('Already prepared');
 const before=read(path.join(dir,'worker-before.json'));
 const secretsDir=path.join(root,'.cache/release-secrets-20261013');fs.mkdirSync(secretsDir,{recursive:true});
 const secretFile=path.join(secretsDir,'notification-worker.json');
 if(!fs.existsSync(secretFile)){
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const local=Object.fromEntries(fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_0-9]+)=(.*)$/);return m?[[m[1],m[2].replace(/^["']|["']$/g,'')]]:[];}));
  if(!local.SUPABASE_SERVICE_ROLE_KEY)throw Error('Missing service role');
  if(before.resources.bindings.some(b=>b.name==='CRON_SECRET'))throw Error('Existing cron secret requires protected reuse');
  const s={SUPABASE_SERVICE_ROLE_KEY:local.SUPABASE_SERVICE_ROLE_KEY,VAPID_PRIVATE_KEY:ecdh.getPrivateKey().toString('base64url'),VAPID_PUBLIC_KEY:ecdh.getPublicKey().toString('base64url'),CRON_SECRET:randomBytes(32).toString('base64url')};
  fs.writeFileSync(secretFile,JSON.stringify(s),{mode:0o600});fs.writeFileSync(path.join(secretsDir,'app.json'),JSON.stringify({CRON_SECRET:s.CRON_SECRET}),{mode:0o600});
 }
 const pub=read(secretFile).VAPID_PUBLIC_KEY;
 const config=fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
 if(!config.includes('NEXT_PUBLIC_VAPID_PUBLIC_KEY'))fs.writeFileSync(path.join(root,'wrangler.jsonc'),config.replace('"vars": {','"vars": {\n    "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "'+pub+'",'));
 const snapshot=path.join(root,'.cache/all-work-release-20261013-'+randomUUID());fs.mkdirSync(snapshot,{recursive:true});
 r={startedAt:new Date().toISOString(),snapshot,origin:'https://roomza.pinpoint-roomza.workers.dev',worker:'roomza',accountId:env.CLOUDFLARE_ACCOUNT_ID,previousVersion:before.id,sourceHashes:{},scopeFiles:[],checks:[],deployed:false,secretsDirectory:secretsDir,scope:'All pending application, branding, account, discovery, notifications, migration, and documentation work; local caches and secrets excluded'};
 const inventory=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);
 const files=inventory.filter(f=>/^(src|public|scripts|supabase|workers|cloudflare)\//.test(f)||(!f.includes('/')&&/\.(jsonc?|[cm]?[jt]s|tsx|md)$/.test(f)));
 for(const f of files){if(!fs.existsSync(path.join(root,f)))continue;const b=fs.readFileSync(path.join(root,f)),out=path.join(snapshot,f);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,b);r.sourceHashes[f]=hash(b);}
 const changed=execFileSync('git',['ls-files','-mo','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);r.scopeFiles=changed.filter(f=>r.sourceHashes[f]);
 const publicEnv=fs.readFileSync(path.join(root,'.env.production.local'),'utf8').split(/\r?\n/).filter(l=>l.startsWith('NEXT_PUBLIC_')&&!l.startsWith('NEXT_PUBLIC_VAPID_PUBLIC_KEY=')).join('\n')+'\nNEXT_PUBLIC_VAPID_PUBLIC_KEY='+pub+'\n';
 fs.writeFileSync(path.join(snapshot,'.env.production.local'),publicEnv);r.publicBuildEnvHash=hash(publicEnv);r.lockfileHash=r.sourceHashes['package-lock.json'];
 save();linkTree(path.join(root,'node_modules'),path.join(snapshot,'node_modules'));verify();console.log(JSON.stringify({snapshot,files:Object.keys(r.sourceHashes).length,rollback:r.previousVersion}));
}else{
 r=read(record);verify();const mode=process.argv[2];
 if(mode==='checks'){
  await run('tests',['node_modules/vitest/vitest.mjs','run','--maxWorkers=2'],true);
  await run('worker-tests',['node_modules/vitest/vitest.mjs','run','--config','vitest.notifications-worker.config.ts']);
  await run('notification-database',['scripts/db/verify-notifications.mjs']);
  await run('typecheck',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']);
  await run('worker-typecheck',['node_modules/typescript/bin/tsc','--project','workers/notifications/tsconfig.json','--noEmit']);
  await run('lint',['node_modules/eslint/bin/eslint.js',...r.scopeFiles.filter(f=>/\.(tsx?|mjs)$/.test(f))]);
  await run('audit',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'audit','--audit-level=moderate','--omit=dev']);
 }else if(mode==='repair-checks'){
  await run('corrected-tests',['node_modules/vitest/vitest.mjs','run','src/components/app-shell.test.tsx','src/app/theme-tokens.test.ts','src/features/discovery/cloudflare-discovery-assets.test.ts','--maxWorkers=2']);
  await run('architecture-baseline',['--import','tsx',path.join(dir,'verify-architecture.mjs')]);
  await run('audit',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'audit','--audit-level=moderate','--omit=dev']);
 }else if(mode==='build'){
  for(const [name,args] of [
   ['build',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','build']],
   ['minification',[path.join(dir,'minify-server.mjs')]],
   ['discovery-assets',['scripts/ops/prepare-discovery-assets.mjs']],
   ['size-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--outdir','.wrangler/worker-size']],
   ['platform-size',[path.join(dir,'check-platform-size.mjs')]],
   ['worker-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--config','workers/notifications/wrangler.jsonc','--dry-run','--outdir','.wrangler/notifications-size']]
  ])if(!r.checks.some(c=>c.name===name&&c.exitCode===0))await run(name,args);
  verify();r.readyAt=new Date().toISOString();save();
 }else if(mode==='deploy'){
  if(!r.readyAt||!r.validationApproved||!fs.existsSync(path.join(dir,'database-verified.json')))throw Error('Incomplete release gates');
  const current=JSON.parse(wrangler(['deployments','list','--name','roomza','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if(current.versions[0].version_id!==r.previousVersion)throw Error('Production changed');
  await run('deploy',['node_modules/wrangler/bin/wrangler.js','deploy','--keep-vars','--secrets-file',path.join(r.secretsDirectory,'app.json'),'--message=all-work-20261013']);
  const after=JSON.parse(wrangler(['deployments','list','--name','roomza','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
  r.deployed=true;r.result={deployment:after[0].id,version:after[0].versions[0].version_id,traffic:after[0].versions};save();
  await run('notification-worker-deploy',['node_modules/wrangler/bin/wrangler.js','deploy','--config','workers/notifications/wrangler.jsonc','--keep-vars','--secrets-file',path.join(r.secretsDirectory,'notification-worker.json'),'--message=notifications-20261013']);
  const worker=JSON.parse(wrangler(['deployments','list','--name','roomza-notifications','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
  r.notificationWorker={deployment:worker[0].id,version:worker[0].versions[0].version_id,traffic:worker[0].versions};save();console.log(JSON.stringify({app:r.result,notifications:r.notificationWorker}));
 }else throw Error('Use prepare, checks, build, or deploy');
}
