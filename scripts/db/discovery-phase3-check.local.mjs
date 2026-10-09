import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID,createHmac,createHash} from 'node:crypto';
import {writeFileSync,readFileSync,unlinkSync,openSync,closeSync,rmSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
const cfg=JSON.parse(process.env.PINPOINT_CLONE_CONFIG),root=cfg.sourceRoot,focused=cfg.mode==='pending-unpublish';assert.ok(['full','pending-unpublish'].includes(cfg.mode));
assert.equal(cfg.supabaseUrl,'http://127.0.0.1:55431');
const spec=JSON.parse(execFileSync('docker',['inspect',cfg.dbName],{encoding:'utf8'}))[0];
assert.ok(spec.Config.Labels['pinpoint.discovery.phase3.run']);assert.deepEqual(spec.HostConfig.PortBindings,{});
assert.match(cfg.dbName,/^pinpoint-pf-[a-f0-9-]{36}-db$/);
assert.equal(spec.Name,'/'+cfg.dbName);
assert.equal(spec.Config.Labels['pinpoint.discovery.phase3.run']+'-db',cfg.dbName);
const require=createRequire(path.join(root,'package.json')),{createClient}=require('@supabase/supabase-js');
const tag='entrypub-'+randomUUID(),password='Fixture-'+randomUUID()+'aA1!',accounts=[],actors=[],checks=[],place=randomUUID();
const evidence={tag,scope:cfg.mode,environment:'Disposable patched clone; genuine Auth/MFA/API/SQL and native cookie browser',checks};
const origin='http://localhost:3116',dist='.next-pinpoint-verify-'+randomUUID(),guard=path.join(tmpdir(),tag+'.cjs'),browserResult=path.join(tmpdir(),tag+'-browser.json'),browserPath=path.join(tmpdir(),'playwright-test-pinpoint-phase3.cjs');
let service,offer,emptyPlace;const originalTs=readFileSync(path.join(root,'tsconfig.json'),'utf8');let app,log,passed=false;
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.ok([cfg.supabaseUrl,origin].includes(url.origin),'Blocked outside clone request');return realFetch(input,init);};
const make=(key=cfg.anonKey)=>createClient(cfg.supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),admin=make(cfg.serviceKey),guest=make();
function sql(q){try{return execFileSync('docker',['exec','-i','-e',`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,'psql','-X','-h','127.0.0.1','-U','supabase_admin','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch(error){throw new Error(String(error.stderr??'').match(/ERROR:[^\r\n]*/)?.[0]??'Clone SQL failed; arguments withheld');}}
const hash=value=>createHash('sha256').update(value).digest('hex');
const catalogue=()=>sql("select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||coalesce(p.proconfig::text,''),E'\\n' order by n.nspname,p.proname,p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'pinpoint_entry_%' and p.prokind='f'");
const catalogueBefore=catalogue();
const policyTrigger=()=>sql("select tgenabled from pg_trigger where tgrelid='public.trust_document_versions'::regclass and tgname='trust_document_versions_immutable'");
assert.equal(policyTrigger(),'O');
function resetBrowserFixtures(){
 for(const a of accounts)assert.equal(sql(`select email from auth.users where id='${a.id}'`),a.email);
 const ids=accounts.map(a=>`'${a.id}'`).join(',');
 const removed=sql(`select coalesce(json_agg(id),'[]') from public.pinpoint_entries where poster_id in(${ids})`);
 sql(`begin;alter table public.pinpoint_entry_events disable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions disable trigger pinpoint_entry_revisions_immutable;alter table public.pinpoint_entry_corrections disable trigger pinpoint_entry_corrections_immutable;alter table public.pinpoint_entry_permissions disable trigger entry_permissions_immutable;alter table public.pinpoint_entry_publication_reviews disable trigger entry_publication_reviews_immutable;alter table public.pinpoint_entry_removals disable trigger entry_removals_immutable;
  delete from public.approved_entry_specials where id in(select id from public.pinpoint_entries where poster_id in(${ids}));delete from public.pinpoint_entry_removals where entry_id in(select id from public.pinpoint_entries where poster_id in(${ids}));delete from public.pinpoint_entry_publication_reviews where poster_id in(${ids});delete from public.pinpoint_entry_permissions where poster_id in(${ids});delete from public.pinpoint_entry_corrections where poster_id in(${ids});delete from public.pinpoint_entry_events where poster_id in(${ids});update public.pinpoint_entries set pending_revision_id=null,approved_revision_id=null where poster_id in(${ids});delete from public.pinpoint_entry_revisions where poster_id in(${ids});delete from public.pinpoint_entries where poster_id in(${ids});
  alter table public.pinpoint_entry_events enable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions enable trigger pinpoint_entry_revisions_immutable;alter table public.pinpoint_entry_corrections enable trigger pinpoint_entry_corrections_immutable;alter table public.pinpoint_entry_permissions enable trigger entry_permissions_immutable;alter table public.pinpoint_entry_publication_reviews enable trigger entry_publication_reviews_immutable;alter table public.pinpoint_entry_removals enable trigger entry_removals_immutable;
delete from public.entry_posters where user_id='${accounts[2].id}';commit;`);
 (evidence.browserFixtureResets??=[]).push({capturedEntryIds:JSON.parse(removed),immutableTriggersRestored:true});
}
function ok(r){assert.equal(r.error,null,JSON.stringify(r.error));return r.data;}
function denied(r,code='42501'){assert.ok(r.error);assert.equal(r.error.code,code);}
const factorSecrets=new Map();
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const letter of secret.replace(/=+$/,''))bits+=alphabet.indexOf(letter).toString(2).padStart(5,'0');const bytes=Buffer.from(bits.match(/.{8}/g).map(v=>parseInt(v,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac('sha1',bytes).update(counter).digest();return((digest.readUInt32BE(digest.at(-1)&15)&0x7fffffff)%1000000).toString().padStart(6,'0');}
async function factor(actor){const e=ok(await actor.auth.mfa.enroll({factorType:'totp',friendlyName:'Fixture '+randomUUID()})),c=ok(await actor.auth.mfa.challenge({factorId:e.id}));ok(await actor.auth.mfa.verify({factorId:e.id,challengeId:c.id,code:totp(e.totp.secret)}));factorSecrets.set(e.id,e.totp.secret);return e.id;}
async function challenge(actor,id){const c=ok(await actor.auth.mfa.challenge({factorId:id}));ok(await actor.auth.mfa.verify({factorId:id,challengeId:c.id,code:totp(factorSecrets.get(id))}));}
const write=(actor,e,command,payload={},revision)=>actor.rpc('pinpoint_entry_write',{target:e.id,category:e.category,expected_version:e.version,command,payload,...(revision?{revision}:{})});
async function change(e,command,payload={},revision){const r=ok(await write(actors[0],e,command,payload,revision));e.version=r.version;if(revision)e.revision=revision;return r;}
const permission=(actor,e)=>actor.rpc('pinpoint_entry_confirm_permission',{target:e.id,category:e.category,expected_version:e.version,revision:e.revision});
const approve=(actor,e,extra={})=>actor.rpc('pinpoint_entry_approve',{target:e.id,category:e.category,expected_version:e.version,revision:e.revision,authority_notes:'Synthetic venue authority checked; fixture only.',location_notes:'Synthetic stored place/address/point/dates checked; fixture only.',media_state:'none',...extra});
const detail=e=>guest.rpc('pinpoint_entry_public_detail',{target:e.id});
const feed=category=>guest.rpc('pinpoint_entry_public_feed',{category,area:place,page:1});
const content=(title,future=false)=>({title,description:'Disposable synthetic content; no real supply or authority.',venueName:'Synthetic venue',areaId:place,address:'Synthetic venue address',latitude:-33.97,longitude:18.48,startsAt:new Date(Date.now()+(future?3600000:-60000)).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()});
async function submission(category,title,future=false){const e={id:randomUUID(),category,version:0};await change(e,'create');await change(e,'save',content(title,future));await change(e,'submit',{},randomUUID());return e;}
async function check(name,fn){await fn();checks.push(name);console.info('PASS '+name);}
try{
 assert.equal(sql('show cron.launch_active_jobs'),'off');assert.equal(sql('select count(*) from cron.job where active'),'0');
 for(let i=0;i<4;i++){const email=`${tag}-${i}@pinpoint.invalid`,u=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;accounts.push({id:u.id,email});sql(`update public.notification_subscriptions set enabled=false,frequency='never' where user_id='${u.id}' and channel='email';insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${u.id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing;`);const actor=make();ok(await actor.auth.signInWithPassword({email,password}));actors.push(actor);}
 sql(`update public.profiles set role='renter' where id='${accounts[2].id}';insert into public.profile_personas(profile_id,persona,is_primary,is_active) values('${accounts[2].id}','renter',true,true) on conflict do nothing;`);
 sql(`insert into public.admin_memberships(user_id,level) values('${accounts[1].id}','admin'),('${accounts[3].id}','owner');insert into public.discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north) values('${place}','${tag}','locality','Entry fixture area','Fixture ZA','Entry fixture area, South Africa',-33.96,18.47,18.4,-34,18.6,-33.9);`);
 for(const category of ['tourism','event'])ok(await actors[0].rpc('pinpoint_entry_enroll',{category}));

 await factor(actors[1]);
 const tourism=await submission('tourism','Phase 3 Tourism fixture'),event=await submission('event','Phase 3 Event fixture',true);
 for(const e of [tourism,event]){ok(await permission(actors[0],e));e.version=ok(await approve(actors[1],e)).version;}
 service=randomUUID();
 const serviceContent={title:'Phase 3 plumbing fixture',providerName:'Synthetic provider with a deliberately long label for responsive coverage',serviceType:'Plumbing',description:'Disposable fixture only; no real service.',areaId:place,address:'Synthetic venue address',latitude:-33.97,longitude:18.48,phone:'+27 21 555 0100'};
 const sw=(version,command,payload={},permission_confirmed=false)=>actors[0].rpc('pinpoint_service_write',{target:service,expected_version:version,command,payload,permission_confirmed});
 ok(await sw(0,'create'));ok(await sw(1,'save',serviceContent));ok(await sw(2,'submit',{},true));ok(await actors[1].rpc('pinpoint_service_decide',{target:service,expected_version:3,decision:'approve',authority_notes:'Synthetic authority only',location_notes:'Synthetic address and point checked'}));
 offer=randomUUID();const revision=randomUUID(),permissionReview=randomUUID(),locationReview=randomUUID();
 ok(await actors[0].rpc('pinpoint_offer_enroll',{}));
 ok(await actors[0].rpc('pinpoint_offer_write',{target:offer,expected_version:0,command:'create'}));
 ok(await actors[0].rpc('pinpoint_offer_write',{target:offer,expected_version:1,command:'save',payload:{title:'Phase 3 Shopping fixture',benefit:'Synthetic benefit only',terms:'Fixture only. No redemption.',shopName:'Synthetic shop',areaId:place,address:'Synthetic venue address',latitude:-33.97,longitude:18.48,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()}}));
 ok(await actors[0].rpc('pinpoint_offer_submit_permission',{target:offer,expected_version:2,revision,permission_confirmed:true,permission_version:'shop-authorization-v1'}));
 ok(await actors[1].rpc('pinpoint_offer_permission_review_write',{target:offer,revision,expected_version:3,request_id:permissionReview,evidence_kind:'written_authorization',source_reference:'Synthetic authority only',verification_note:'Synthetic poster shop offer address scope; no real permission',authorization_checked:true,statement_version:'admin-permission-review-v1'}));
 const location=ok(await actors[1].rpc('pinpoint_offer_location_review_read',{target:offer}));
 ok(await actors[1].rpc('pinpoint_offer_location_review_write',{target:offer,revision,expected_version:3,request_id:locationReview,permission_review_id:permissionReview,place_snapshot:location.place,provenance_reference:'Synthetic ZA provider source',shop_reference:'Synthetic public point address source',verification_note:'Synthetic fixture only; no real authority',provenance_checked:true,shop_checked:true,content_checked:true,dates_checked:true,statement_version:'admin-location-review-v1'}));
 ok(await actors[1].rpc('pinpoint_offer_approve',{target:offer,revision,expected_version:3,request_id:randomUUID(),permission_review_id:permissionReview,location_review_id:locationReview,approval_confirmed:true,statement_version:'admin-offer-approval-v1'}));
 emptyPlace=randomUUID();sql(`insert into public.discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north) values('${emptyPlace}','${tag}-empty','locality','Entry fixture area','Different fixture region','Entry fixture area, Different fixture region, South Africa',-25.9,28.1,28,-26,28.2,-25.8);`);
 evidence.fixtureIds={place,emptyPlace,service,offer,tourism:tourism.id,event:event.id};
 checks.push('Real poster Auth and reviewer TOTP MFA approved synthetic Shopping, Tourism, future Event and Service fixtures; separate stored duplicate-label UUIDs');
 writeFileSync(guard,`const real=globalThis.fetch;globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['${origin}','${cfg.supabaseUrl}'].includes(u.origin))throw new Error('Blocked external fixture fetch');return real(input,init)};`);
 const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:cfg.supabaseUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:cfg.anonKey,SUPABASE_SERVICE_ROLE_KEY:cfg.serviceKey,NEXT_PUBLIC_APP_URL:origin,NEXT_TELEMETRY_DISABLED:'1',LOG_LEVEL:'warn',NODE_OPTIONS:`--require ${guard}`,PINPOINT_LOCAL_VERIFY_DIST_DIR:dist};delete env.PINPOINT_CLONE_CONFIG;
 for(const key of ['RESEND_API_KEY','QSTASH_TOKEN','QSTASH_CURRENT_SIGNING_KEY','QSTASH_NEXT_SIGNING_KEY','CRON_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','VAPID_PRIVATE_KEY','NEXT_PUBLIC_VAPID_PUBLIC_KEY','NEXT_PUBLIC_SENTRY_DSN','SENTRY_DSN','NEXT_PUBLIC_TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY'])env[key]='';env.NEXT_PUBLIC_MAPTILER_API_KEY='fixture-map-key';
 log=openSync(path.join(tmpdir(),tag+'-app.log'),'w');app=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port','3116'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
 let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(origin+'/api/entries?category=tourism&areaId='+place,{signal:AbortSignal.timeout(30000)})).status===200}catch{}if(ready)break;await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'App readiness failed');
 const {createServerClient}=require('@supabase/ssr');async function cookies(actor){const output=[],ssr=createServerClient(cfg.supabaseUrl,cfg.anonKey,{cookies:{getAll:()=>[],setAll:values=>output.push(...values)}});ok(await ssr.auth.setSession((await actor.auth.getSession()).data.session));return output.map(c=>({name:c.name,value:c.value,url:origin,sameSite:'Lax'}));}
 writeFileSync(browserPath,readFileSync(path.join(root,'scripts/db/discovery-phase3-browser-source.cjs'),'utf8'));
 evidence.browserDriverSource=readFileSync(browserPath,'utf8');evidence.browserDriverSha256=hash(evidence.browserDriverSource);
 const browserCfg={origin,place,emptyPlace,fixtureIds:evidence.fixtureIds,posterCookies:await cookies(actors[0]),login:{email:accounts[2].email,password},posterLogin:{email:accounts[0].email,password},resultPath:browserResult,sourceRoot:root};

 evidence.browserAttempts=[];
 // BB explicitly approved exactly attempt 9 in this chat on 2026-10-04 SAST.
 // Prior attempts are retained separately; no further automatic retries are authorized.
 evidence.browserAuthorization={attempt:9,maxAttemptsThisContinuation:1,userReply:'Approve exactly attempt 9',dateSast:'2026-10-04'};
 for(let attempt=9;attempt<=9;attempt++){
  const driver=path.join(root,'scripts/db/discovery-phase3-browser-source.cjs');writeFileSync(browserPath,readFileSync(driver,'utf8'));
  evidence.browserDriverSource=readFileSync(browserPath,'utf8');evidence.browserDriverSha256=hash(evidence.browserDriverSource);
  try{unlinkSync(browserResult)}catch(error){if(error.code!=='ENOENT')throw error;}
  const attemptId=randomUUID();
  const child=spawn(process.execPath,['C:/Users/BB/.agents/skills/playwright/run.js',browserPath],{cwd:root,env:{...process.env,PINPOINT_BROWSER_CONFIG:JSON.stringify({...browserCfg,attemptId})},stdio:'inherit',windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
  const result=existsSync(browserResult)?JSON.parse(readFileSync(browserResult,'utf8')):{passed:false,failure:'Driver did not produce evidence'};
  if(result.attemptId)assert.equal(result.attemptId,attemptId,'Stale browser result');
  evidence.browserAttempts.push({attempt,driverSha256:evidence.browserDriverSha256,...result});
  if(code===0){evidence.browser=result;checks.push(...result.checks);break;}
  if(attempt===9)break;
 }
 assert.ok(evidence.browser?.passed,'Browser journey failed');
 passed=true;
}catch(error){evidence.failure={name:error.name,message:String(error.message).slice(0,1800)};console.error(evidence.failure);process.exitCode=1;}
finally{
 try{
 if(app&&app.exitCode===null){try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F'],{stdio:'ignore'})}catch{app.kill()}}if(log!==undefined)closeSync(log);
 for(const actor of actors)await actor.auth.signOut().catch(()=>{});
 if(accounts.length){for(const a of accounts)assert.equal(sql(`select email from auth.users where id='${a.id}'`),a.email);const ids=accounts.map(a=>`'${a.id}'`).join(',');

  sql(`begin;
   alter table public.service_submission_events disable trigger service_history_immutable;
   delete from public.approved_services where id='${service}';delete from public.service_submission_events where service_id='${service}';delete from public.service_submissions where id='${service}' and poster_id in(${ids});
   alter table public.service_submission_events enable trigger service_history_immutable;
   alter table public.shopping_offer_decisions disable trigger shopping_offer_decisions_immutable;alter table public.shopping_offer_location_reviews disable trigger shopping_offer_location_reviews_immutable;alter table public.shopping_offer_permission_reviews disable trigger shopping_offer_permission_reviews_immutable;alter table public.shopping_offer_permissions disable trigger shopping_offer_permissions_immutable;alter table public.shopping_offer_events disable trigger shopping_offer_events_immutable;alter table public.shopping_offer_revisions disable trigger shopping_offer_revisions_immutable;
   delete from public.shopping_offer_decisions where offer_id='${offer}' and poster_id in(${ids});delete from public.shopping_offer_location_reviews where offer_id='${offer}' and poster_id in(${ids});delete from public.shopping_offer_permission_reviews where offer_id='${offer}' and poster_id in(${ids});delete from public.shopping_offer_permissions where offer_id='${offer}' and poster_id in(${ids});update public.shopping_offers set pending_revision_id=null where id='${offer}' and poster_id in(${ids});delete from public.shopping_offer_events where poster_id in(${ids});delete from public.shopping_offer_revisions where offer_id='${offer}' and poster_id in(${ids});delete from public.shopping_offers where id='${offer}' and poster_id in(${ids});delete from public.offer_posters where user_id in(${ids});
   alter table public.shopping_offer_decisions enable trigger shopping_offer_decisions_immutable;alter table public.shopping_offer_location_reviews enable trigger shopping_offer_location_reviews_immutable;alter table public.shopping_offer_permission_reviews enable trigger shopping_offer_permission_reviews_immutable;alter table public.shopping_offer_permissions enable trigger shopping_offer_permissions_immutable;alter table public.shopping_offer_events enable trigger shopping_offer_events_immutable;alter table public.shopping_offer_revisions enable trigger shopping_offer_revisions_immutable;
   delete from public.discovery_places where id='${emptyPlace}' and provider_id='${tag}-empty';commit;`);
  sql(`begin;alter table public.pinpoint_entry_events disable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions disable trigger pinpoint_entry_revisions_immutable;alter table public.pinpoint_entry_corrections disable trigger pinpoint_entry_corrections_immutable;alter table public.pinpoint_entry_permissions disable trigger entry_permissions_immutable;alter table public.pinpoint_entry_publication_reviews disable trigger entry_publication_reviews_immutable;alter table public.pinpoint_entry_removals disable trigger entry_removals_immutable;
  delete from public.approved_entry_specials where id in(select id from public.pinpoint_entries where poster_id in(${ids}));delete from public.pinpoint_entry_removals where entry_id in(select id from public.pinpoint_entries where poster_id in(${ids}));delete from public.pinpoint_entry_publication_reviews where poster_id in(${ids});delete from public.pinpoint_entry_permissions where poster_id in(${ids});delete from public.pinpoint_entry_corrections where poster_id in(${ids});delete from public.pinpoint_entry_events where poster_id in(${ids});update public.pinpoint_entries set pending_revision_id=null,approved_revision_id=null where poster_id in(${ids});delete from public.pinpoint_entry_revisions where poster_id in(${ids});delete from public.pinpoint_entries where poster_id in(${ids});delete from public.entry_posters where user_id in(${ids});
  alter table public.pinpoint_entry_events enable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions enable trigger pinpoint_entry_revisions_immutable;alter table public.pinpoint_entry_corrections enable trigger pinpoint_entry_corrections_immutable;alter table public.pinpoint_entry_permissions enable trigger entry_permissions_immutable;alter table public.pinpoint_entry_publication_reviews enable trigger entry_publication_reviews_immutable;alter table public.pinpoint_entry_removals enable trigger entry_removals_immutable;
  delete from public.account_suspensions where user_id in(${ids}) and reason='${tag}';alter table public.admin_memberships disable trigger admin_memberships_last_owner;delete from public.admin_memberships where user_id in(${ids});alter table public.admin_memberships enable trigger admin_memberships_last_owner;delete from public.discovery_places where id='${place}' and provider_id='${tag}';commit;`);
  for(const a of accounts)ok(await admin.auth.admin.deleteUser(a.id));
 }
 const tsFile=path.join(root,'tsconfig.json'),ts=JSON.parse(readFileSync(tsFile,'utf8'));ts.include=ts.include.filter(p=>!p.startsWith(dist+'/'));assert.deepEqual(ts,JSON.parse(originalTs));writeFileSync(tsFile,originalTs);
 const resolved=path.resolve(root,dist);assert.ok(resolved.startsWith(path.resolve(root)+path.sep));assert.match(path.basename(resolved),/^\.next-pinpoint-verify-[a-f0-9-]+$/);rmSync(resolved,{recursive:true,force:true});for(const file of [guard,browserResult])try{unlinkSync(file)}catch{}
 assert.equal(catalogue(),catalogueBefore);assert.equal(policyTrigger(),'O');evidence.cleanup={capturedAccountsRemoved:accounts.map(a=>a.id),fixturePlaceRemoved:place,immutableTriggersRestored:true,policyImmutableTriggerRestored:true,newFunctionsUnchanged:true,appStopped:true,testBuildDirectoryRemoved:true};
 }catch(error){passed=false;process.exitCode=1;evidence.cleanupFailure={message:String(error.message).slice(0,1600)};console.error(evidence.cleanupFailure);}
 evidence.recordedAt=new Date().toISOString();evidence.passed=passed;writeFileSync(cfg.resultPath,JSON.stringify(evidence,null,2)+'\n');console.info('Entry fixtures cleaned and isolated app stopped');
}
assert.ok(passed);
