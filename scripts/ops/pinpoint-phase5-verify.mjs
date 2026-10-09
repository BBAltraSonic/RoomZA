import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';

const root=process.cwd(), mode=process.argv[2];
assert.ok(['quality','build','repair','rebuild','worker'].includes(mode));
const logs=path.join(root,'docs/pinpoint-phase5-logs'); mkdirSync(logs,{recursive:true});
const resultPath=path.join(root,`docs/pinpoint-phase5-${mode==='quality'?'quality':'build'}-2026-10-06.json`);
const result=existsSync(resultPath)?JSON.parse(readFileSync(resultPath,'utf8')):{checks:[]};
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{NEXT_TELEMETRY_DISABLED:'1',CI:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:59999',NEXT_PUBLIC_SUPABASE_ANON_KEY:'phase5-build-placeholder',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3000'});
async function run(name,command,cwd){
 const ordinal=result.checks.filter(c=>c.name===name).length+1;
 const start=Date.now(), log=path.join(logs,`${name}${ordinal>1?'-'+ordinal:''}.log`);
 const child=spawn(process.env.ComSpec??'cmd.exe',['/d','/s','/c',command],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>output+=b.toString());
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
 writeFileSync(log,output);
 const entry={name,command,cwd,exitCode:code,seconds:(Date.now()-start)/1000,log:path.relative(root,log).replaceAll('\\','/'),logSha256:createHash('sha256').update(output).digest('hex')};
 result.checks.push(entry);result.recordedAt=new Date().toISOString();writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(entry));console.log(output.slice(-2200));return code;
}
if(['repair','rebuild','worker'].includes(mode)){
 const dir=result.buildSnapshot.path;
 assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep)&&/^pinpoint-phase5-build-[0-9a-f-]{36}$/.test(path.basename(dir)));
 if(mode==='repair')await run('lock-patch','npm update source-map-js --package-lock-only --ignore-scripts',dir);
 if(mode==='rebuild'){
  for(const p of ['package-lock.json','src/app/issue4-test/page.tsx','src/app/issue4-test/detail-panel.tsx']){mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});copyFileSync(p,path.join(dir,p));result.buildSnapshot.sourceHashes[p]=createHash('sha256').update(readFileSync(p)).digest('hex');}
  const install=await run('install-final','npm ci',dir);
  if(install===0){await run('build-final','npm run build',dir);await run('audit-prod-final','npm run audit:prod',dir);}
 }
 if(mode==='worker'){
  for(const p of ['src/app/issue4-test/detail-panel.tsx','eslint.config.mjs']){copyFileSync(p,path.join(dir,p));result.buildSnapshot.sourceHashes[p]=createHash('sha256').update(readFileSync(p)).digest('hex');}
  const adapter=await run('worker-adapter','node node_modules/@opennextjs/cloudflare/dist/cli/index.js build',dir);
  if(adapter===0)await run('worker-size','npm run cf:check:size',dir);
 }
}else if(mode==='quality'){
 await Promise.all(['test','typecheck','lint'].map(name=>run(name,`npm run ${name}`,root)));
}else{
 const dir=path.join(tmpdir(),`pinpoint-phase5-build-${randomUUID()}`);mkdirSync(dir);
 const baseline=JSON.parse(readFileSync('docs/pinpoint-phase5-baseline-2026-10-06.json','utf8'));
 const files=Object.keys(baseline.sourceHashes).filter(p=>!p.startsWith('docs/')&&!path.basename(p).startsWith('.env')&&!p.startsWith('artifacts/')&&!p.startsWith('.wrangler/')&&!p.startsWith('.open-next/')&&!p.startsWith('.codex/')&&!p.startsWith('.agents/')&&!/\.(log|tsbuildinfo)$/.test(p));
 for(const p of files){if(!existsSync(p))continue;const target=path.join(dir,p);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(p,target);}
 result.buildSnapshot={path:dir,files:files.length,credentialsExcluded:true,environment:'allowlisted OS variables and inert loopback placeholders',sourceHashes:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))};writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');
 console.log(`Isolated snapshot: ${dir}`);
 const install=await run('install','npm ci',dir);
 if(install===0){await run('build','npm run build',dir);await run('audit-prod','npm run audit:prod',dir);}
}
