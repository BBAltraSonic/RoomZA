import {spawn,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
const root=process.cwd(),dir=path.join(root,'docs/render-race-20261008');mkdirSync(dir,{recursive:true});
const mode=process.argv[2];if(!['quality','build','rebuild'].includes(mode))throw Error('Use quality or build');
const outputPath=path.join(dir,(mode==='rebuild'?'build':mode)+'.json');
const baseline=JSON.parse(readFileSync(path.join(dir,'baseline.json')));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:59991',NEXT_PUBLIC_SUPABASE_ANON_KEY:'render-race-inert-anon',SUPABASE_SERVICE_ROLE_KEY:'render-race-inert-service',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3098',NEXT_PUBLIC_MAPTILER_API_KEY:'render-race-fixture'});
const result={startedAt:new Date().toISOString(),checks:[],credentialPolicy:'OS allowlist plus inert loopback placeholders; no env files copied'};
function save(){writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');}
async function run(name,command,cwd){
 const started=Date.now(),log=path.join(dir,mode+'-'+name+'-'+randomUUID()+'.log');
 const child=spawn(process.env.ComSpec??'cmd.exe',['/d','/s','/c',command],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>output+=b.toString());
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});writeFileSync(log,output);
 const check={name,command,exitCode:code,seconds:(Date.now()-started)/1000,log:path.relative(root,log).replaceAll('\\','/'),logSha256:hash(log)};result.checks.push(check);save();console.log(JSON.stringify(check));console.log(output.slice(-3000));return code;
}
function walk(base){return readdirSync(base,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(base,e.name)):[path.join(base,e.name)]);}
if(mode==='quality'){
 const changed=walk(path.join(root,'src')).filter(p=>/\.(ts|tsx)$/.test(p)).filter(p=>baseline.hashes[path.relative(root,p).replaceAll('\\','/')]!==hash(p)).map(p=>path.relative(root,p).replaceAll('\\','/'));
 result.changedSource=changed;save();
 const codes=await Promise.all([run('tests','npm test',root),run('typecheck','npx tsc --noEmit --incremental false',root),run('lint','npx eslint '+changed.join(' '),root)]);
 process.exitCode=codes.some(c=>c!==0)?1:0;
}else{
 const snapshot=mode==='rebuild'?JSON.parse(readFileSync(outputPath)).snapshot.path:path.join(tmpdir(),'pinpoint-render-build-'+randomUUID());
 if(!path.resolve(snapshot).startsWith(path.resolve(tmpdir())+path.sep)||!/^pinpoint-render-build-[0-9a-f-]{36}$/.test(path.basename(snapshot)))throw Error('Invalid owned snapshot');
 mkdirSync(snapshot,{recursive:true});
 const files=execFileSync('git',['ls-files','-c','-o','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p&&!p.startsWith('docs/')&&!p.startsWith('.agents/')&&!p.startsWith('.codex/')&&!p.startsWith('.wrangler/')&&!p.startsWith('.open-next/')&&!p.startsWith('artifacts/')&&!p.split('/').some(s=>s.startsWith('.env'))&&!/\.(log|tsbuildinfo)$/.test(p)&&existsSync(path.join(root,p)));
 for(const p of files){const target=path.join(snapshot,p);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,p),target);}
 result.snapshot={path:snapshot,files:files.length,sourceHashes:Object.fromEntries(files.map(p=>[p,hash(path.join(root,p))]))};save();console.log('Snapshot: '+snapshot);
 if(mode==='rebuild'||await run('install','npm ci',snapshot)===0)process.exitCode=await run('production','npm run build',snapshot);else process.exitCode=1;
}
