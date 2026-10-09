import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
const root=process.cwd(), dir=path.join(root,'docs/cloudflare-deploy-20261008'), manifestPath=path.join(dir,'release.json');
const hash=b=>createHash('sha256').update(b).digest('hex'), mode=process.argv[2];
const prior=JSON.parse(fs.readFileSync(path.join(root,'artifacts/signup-roles-20261008/release.json')));
const publicInputs=createRequire(import.meta.url)('../../node_modules/dotenv').parse(fs.readFileSync(path.join(prior.build,'.env.production.local')));
if(Object.keys(publicInputs).some(k=>!k.startsWith('NEXT_PUBLIC_')))throw Error('Unexpected nonpublic build input');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',CLOUDFLARE_ACCOUNT_ID:prior.accountId});
let release;const save=()=>fs.writeFileSync(manifestPath,JSON.stringify(release,null,2)+'\n');
async function run(name,command){
 const start=Date.now(),log=fs.createWriteStream(path.join(dir,name+'.log'));
 const child=spawn(env.ComSpec??env.COMSPEC??'cmd.exe',['/d','/s','/c',command],{cwd:release.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});log.end();
 release.checks.push({name,command,exitCode:code,seconds:(Date.now()-start)/1000});save();console.log(name+': '+code);
 if(code!==0)throw Error(name+' failed; inspect retained log');
}
if(mode==='prepare'){
 const snapshot=path.join(tmpdir(),'pinpoint-cloudflare-release-'+randomUUID());fs.mkdirSync(snapshot);
 const files=[...new Set(execFileSync('git',['ls-files','-c','-o','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/))].filter(p=>p&&!/^(docs|artifacts|\.agents|\.codex|\.wrangler|\.open-next)\//.test(p)&&!p.split('/').some(s=>s.startsWith('.env'))&&!/\.(log|tsbuildinfo)$/.test(p)&&fs.existsSync(path.join(root,p)));
 release={startedAt:new Date().toISOString(),snapshot,worker:prior.worker,accountId:prior.accountId,origin:prior.origin,previousVersion:prior.result.version,previousDeployment:prior.result.deployment,sourceHashes:{},checks:[],serverSecretsProvided:false,browserAttempts:0};
 for(const p of files){const src=path.join(root,p);if(!fs.statSync(src).isFile())continue;const dst=path.join(snapshot,p);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);release.sourceHashes[p]=hash(fs.readFileSync(src));}
 for(const p of ['.env.local','.env.production.local','package-lock.json'])release.sourceHashes[p]=hash(fs.readFileSync(path.join(root,p)));
 fs.writeFileSync(path.join(snapshot,'.env.production.local'),Object.entries(publicInputs).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n');
 fs.appendFileSync(path.join(snapshot,'next.config.ts'),'\n// Isolated release only: limit generated cache disk usage.\nconst releaseWebpack = nextConfig.webpack;\nnextConfig.webpack = (config, context) => { const result = releaseWebpack ? releaseWebpack(config, context) : config; result.cache = false; return result; };\n');
 release.buildOnlyOverride='Disable persistent webpack cache in isolated snapshot';save();console.log(JSON.stringify({snapshot,files:files.length}));
}else{
 release=JSON.parse(fs.readFileSync(manifestPath));
 if(mode==='build'){
  await run('install','npm ci');await run('lint','npm run lint');await run('typecheck','npm run typecheck');await run('tests','npm test');await run('audit','npm run audit:prod');await run('build','npx opennextjs-cloudflare build');await run('discovery','node scripts/ops/prepare-discovery-assets.mjs');await run('size','npm run cf:check:size');
  release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
 }else if(mode==='deploy'){
  const drift=Object.entries(release.sourceHashes).filter(([p,h])=>!fs.existsSync(path.join(root,p))||hash(fs.readFileSync(path.join(root,p)))!==h).map(([p])=>p);
  if(drift.length)throw Error('Source drift: '+drift.join(', '));if(!release.readyAt)throw Error('Build gates incomplete');
  await run('deploy','npx opennextjs-cloudflare deploy -- --keep-vars --message cloudflare-deploy-20261008');
 }else throw Error('Use prepare, build or deploy');
}
