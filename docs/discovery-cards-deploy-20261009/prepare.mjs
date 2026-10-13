import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash,randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const root=process.cwd(),dir=path.join(root,'docs/discovery-cards-deploy-20261009'),record=path.join(dir,'release.json');
const prior=JSON.parse(fs.readFileSync('artifacts/discovery-viewport-20261008/release.json'));
const sourceBundle=JSON.parse(fs.readFileSync('artifacts/discovery-cards/discovery-cards-2026-10-09T12-06-58-561Z.zip.manifest.json'));
const scoped=sourceBundle.entries.map(x=>x.path==="supabase/migrations/20261009105638_discovery_cards_media_saves.sql"?"supabase/migrations/20261009124326_discovery_cards_media_saves.sql":x.path).filter(x=>x!=='src/lib/supabase/types.ts');
const additions=['src/features/guest-contact/schema.ts','src/features/guest-contact/contact-actions.tsx'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(key.toUpperCase())));
Object.assign(env,{CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=2048',CLOUDFLARE_ACCOUNT_ID:prior.accountId});
let release; const save=()=>fs.writeFileSync(record,JSON.stringify(release,null,2));
function linkTree(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(['.cache','.vite'].includes(e.name))continue;const source=path.join(from,e.name),dest=path.join(to,e.name);if(e.isDirectory())linkTree(source,dest);else if(e.isSymbolicLink())throw Error('Unexpected dependency symlink');else fs.linkSync(source,dest);}}
function adapt(file,text){
 // Remove only unshipped contact-input/consent logic from the exact named card files.
 if(['src/features/offers/offer-draft-editor.tsx','src/features/entries/entry-draft-editor.tsx','src/features/services/service-workspace.tsx'].includes(file)){
  text=text.replaceAll('values, areaId, contact, contactConsent, presentation','values, areaId, undefined, undefined, presentation');
  text=text.split('\n').filter(line=>!line.includes('@/features/guest-contact/')&&!line.includes('<ContactFields ')&&!line.includes('<div className="sm:col-span-2"><dt>Guest enquiries')&&!line.includes('const [contact,')&&!line.includes('const [contactConsent,')&&!line.includes('requirePublicContact(')&&!line.includes('result.publicContact =')&&!line.includes('result.contactConsent =')&&!line.includes('initial.guest_contact_exempt')&&!line.includes('setContactConsent(false)')).join('\n');
 }
 if(['src/features/offers/offer-draft-form.ts','src/features/entries/entry-draft-form.ts'].includes(file))text=text.split('\n').filter(line=>!line.includes('if (contact)')).join('\n').replace('publicContactSchema, type PublicContact','type PublicContact');
 if(file==='src/features/services/data.ts')text=text.replaceAll(',guest_contact_exempt','').split('\n').filter(line=>!line.includes('guest_contact_exempt: boolean')).join('\n');
 if(['src/features/offers/offer-review-editor.tsx','src/app/admin/services/page.tsx'].includes(file))text=text.split('\n').filter(line=>!line.includes('ContactPreview')).join('\n');
 if(file==='src/features/services/service-feed-card.tsx'){
  text=text.split('\n').filter(line=>!line.includes('@/features/guest-contact/')).join('\n');
  text=text.replace('<ContactActions contact={servicePublicContact(item.content)} title={item.content.title} />','<a href={"tel:" + item.content.phone.replace(/[ ()-]/g, "")} className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-forest underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">Call {item.content.phone}</a>');
 }
 if(file==='src/features/discovery/feed-cards.test.tsx')text=text.replace('name: "Call"','name: "Call " + service.content.phone');
 return text;
}
function verify(){for(const [file,h] of Object.entries(release.sourceHashes))if(hash(fs.readFileSync(path.join(release.snapshot,file)))!==h)throw Error('Snapshot drift: '+file);for(const [file,h] of Object.entries(release.inputHashes))if(hash(fs.readFileSync(file))!==h)throw Error('Workspace source drift: '+file);}
async function run(name,command){const start=Date.now(),log=fs.createWriteStream(path.join(dir,name+'.log'));const child=spawn(env.COMSPEC??env.ComSpec??'cmd.exe',['/d','/s','/c',command],{cwd:release.snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await new Promise(resolve=>log.end(resolve));release.checks.push({name,command,exitCode,seconds:(Date.now()-start)/1000});save();console.log(name+': '+exitCode);if(exitCode!==0)throw Error(name+' failed');}
if(process.argv[2]==='prepare'){
 if(fs.existsSync(record))throw Error('Release already prepared');
 const snapshot=path.join(tmpdir(),'pinpoint-specials-cards-release-'+randomUUID());fs.mkdirSync(snapshot);
 release={startedAt:new Date().toISOString(),snapshot,baseManifest:'artifacts/discovery-viewport-20261008/release.json',worker:prior.worker,origin:prior.origin,accountId:prior.accountId,previousVersion:prior.result.version,previousDeployment:prior.result.deployment,sourceHashes:{},inputHashes:{},changes:[],checks:[],browserAttempts:0,deployed:false,databaseMigration:'20261009124326_discovery_cards_media_saves.sql',guestMigrationExcluded:true,unrelatedPropertyAndMobileChangesExcluded:true};
 for(const [file,h] of Object.entries(prior.sourceHashes)){const source=path.join(prior.snapshot,file);if(hash(fs.readFileSync(source))!==h)throw Error('Baseline drift: '+file);const dest=path.join(snapshot,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);release.sourceHashes[file]=h;}
 for(const file of [...scoped,...additions]){const source=fs.readFileSync(file),bytes=Buffer.from(adapt(file,source.toString()));const dest=path.join(snapshot,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);release.inputHashes[file]=hash(source);release.sourceHashes[file]=hash(bytes);release.changes.push({path:file,adapted:hash(source)!==hash(bytes),sha256:hash(bytes)});}
 // Preserve baseline generated DB typing; new card APIs use validated JSON RPC contracts.
 // The production Property source is exactly the last deployed version.
 const buildEnv=fs.readFileSync(path.join(prior.snapshot,'.env.production.local'),'utf8');if(buildEnv.split(/\r?\n/).some(line=>line.trim()&&!line.startsWith('NEXT_PUBLIC_')))throw Error('Nonpublic build input');fs.writeFileSync(path.join(snapshot,'.env.production.local'),buildEnv);release.publicBuildEnvHash=hash(buildEnv);
 linkTree(path.join(prior.snapshot,'node_modules'),path.join(snapshot,'node_modules'));release.dependencies='Hardlinked verified last-deployed locked dependencies';save();verify();console.log(snapshot);
}else if(process.argv[2]==='build'){
 release=JSON.parse(fs.readFileSync(record));verify();
 await run('tests','npx vitest run src/features/discovery src/features/offers src/features/entries src/app/api/discovery/viewport --maxWorkers=1');
 await run('typecheck','npm run typecheck');
 await run('lint','npx eslint src/features/discovery src/features/offers src/features/entries src/features/services src/app/saved src/app/admin/services/page.tsx src/app/api/discovery-media src/app/api/saved-specials');
 await run('audit','npm run audit:prod');
 await run('build','npx opennextjs-cloudflare build');
 await run('minification','node --max-old-space-size=4096 '+JSON.stringify(path.join(dir,'minify-server.mjs')));release=JSON.parse(fs.readFileSync(record));
 await run('discovery-assets','node scripts/ops/prepare-discovery-assets.mjs');
 await run('size','npm run cf:check:size');verify();release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
}else if(process.argv[2]==='finalize'){
 release=JSON.parse(fs.readFileSync(record));verify();await run('size','npm run cf:check:size');verify();release.workerSha256=hash(fs.readFileSync(path.join(release.snapshot,'.wrangler/worker-size/worker.js')));release.readyAt=new Date().toISOString();save();
}else throw Error('Use prepare, build or finalize');
