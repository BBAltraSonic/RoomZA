import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url)),record=path.join(dir,'release.json');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=4096 --dns-result-order=ipv4first',CLOUDFLARE_ACCOUNT_ID:'78269b65c633a2cc3664af5bfd05774d',WRANGLER_LOG_PATH:path.join(dir,'wrangler.log')});
let release;
const save=()=>fs.writeFileSync(record,JSON.stringify(release,null,2));
const wrangler=args=>JSON.parse(execFileSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:root,env,encoding:'utf8',windowsHide:true}));
const latest=()=>wrangler(['deployments','list','--name','roomza','--json']).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
function dependencies(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(['.cache','.vite'].includes(e.name))continue;const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())dependencies(a,b);else if(e.isSymbolicLink())throw Error('Unexpected dependency symlink');else fs.linkSync(a,b);}}
function verify(){for(const [file,sha]of Object.entries(release.sourceHashes))if(hash(fs.readFileSync(path.join(release.snapshot,file)))!==sha)throw Error('Snapshot drift '+file);for(const file of release.scopeFiles)if(hash(fs.readFileSync(path.join(root,file)))!==release.sourceHashes[file])throw Error('Workspace drift '+file);for(const file of release.removedFiles)if(fs.existsSync(path.join(release.snapshot,file))||fs.existsSync(path.join(root,file)))throw Error('Retired source remains '+file);}
async function run(name,args){const log=fs.createWriteStream(path.join(dir,name+'.log')),start=Date.now();const child=spawn(process.execPath,args,{cwd:release.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await new Promise(resolve=>log.end(resolve));const saved=read(record);for(const k of ['packagingMinification','platformSize'])if(saved[k])release[k]=saved[k];release.checks.push({name,exitCode:code,seconds:(Date.now()-start)/1000});save();console.log(name+': '+code);if(code!==0)throw Error('Failed '+name);}
if(process.argv[2]==='prepare'){
 if(fs.existsSync(record))throw Error('Already prepared');
 const prior=read(path.join(root,'docs/no-email-verification-20261012/release.json')),current=latest(),scope=read(path.join(dir,'scope.json'));
 if(!prior.deployed||current.versions.length!==1||current.versions[0].percentage!==100||current.versions[0].version_id!==prior.result.version)throw Error('Production baseline changed');
 const snapshot=path.join(root,'.cache','unified-marketplace-release-'+randomUUID());fs.mkdirSync(snapshot);
 release={snapshot,origin:prior.origin,worker:prior.worker,accountId:prior.accountId,previousVersion:current.versions[0].version_id,previousDeployment:current.id,scope:'Deploy current unified marketplace account changes and all remaining application work from 12 October; preserve verified production baseline',scopeFiles:scope.files,removedFiles:scope.removed,sourceHashes:{},checks:[],deployed:false};
 for(const [file,sha]of Object.entries(prior.sourceHashes)){if(hash(fs.readFileSync(path.join(prior.snapshot,file)))!==sha)throw Error('Baseline source drift '+file);if(scope.removed.includes(file))continue;const bytes=fs.readFileSync(path.join(scope.files.includes(file)?root:prior.snapshot,file));const target=path.join(snapshot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);release.sourceHashes[file]=hash(bytes);}
 for(const file of scope.files.filter(f=>!release.sourceHashes[f])){const bytes=fs.readFileSync(path.join(root,file)),target=path.join(snapshot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);release.sourceHashes[file]=hash(bytes);}
 const publicEnv=fs.readFileSync(path.join(prior.snapshot,'.env.production.local'),'utf8');if(publicEnv.split(/\r?\n/).some(l=>l.trim()&&!l.startsWith('NEXT_PUBLIC_')))throw Error('Nonpublic build input');fs.writeFileSync(path.join(snapshot,'.env.production.local'),publicEnv);
 dependencies(path.join(prior.snapshot,'node_modules'),path.join(snapshot,'node_modules'));save();verify();console.log(JSON.stringify({snapshot,scopeFiles:scope.files.length,retired:scope.removed.length,previousVersion:release.previousVersion}));
}else{
 release=read(record);verify();
 if(process.argv[2]==='build'){
 const stages=[['tests',['node_modules/vitest/vitest.mjs','run','--maxWorkers=2']],['typecheck',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']],['lint',['node_modules/eslint/bin/eslint.js',...release.scopeFiles.filter(f=>/\.tsx?$/.test(f))]],['audit',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'audit','--audit-level=moderate','--omit=dev']],['build',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','build']],['minification',[path.join(dir,'minify-server.mjs')]],['discovery-assets',['scripts/ops/prepare-discovery-assets.mjs']],['size-dry-run',['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--outdir','.wrangler/worker-size']],['platform-size',[path.join(dir,'check-platform-size.mjs')]]];
 for(const [name,args]of stages)if(!(name==='tests'&&release.testValidation?.passedForRelease)&&!release.checks.some(c=>c.name===name&&c.exitCode===0))await run(name,args);verify();release.readyAt=new Date().toISOString();release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));save();
 }else if(process.argv[2]==='deploy'){
 if(!release.readyAt||!read(path.join(dir,'database-verified.json')).passed)throw Error('Required verification incomplete');if(latest().id!==release.previousDeployment)throw Error('Production changed');if(hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')))!==release.workerSha256)throw Error('Worker drift');
 await run('deploy',['node_modules/@opennextjs/cloudflare/dist/cli/index.js','deploy','--','--keep-vars','--message=unified-marketplace-20261012']);const after=latest();release.deployed=true;release.result={deployment:after.id,version:after.versions[0].version_id,traffic:after.versions};save();console.log(JSON.stringify(release.result));
 }else throw Error('Use prepare, build or deploy');
}
