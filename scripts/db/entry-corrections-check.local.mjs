import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHmac,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const cfg=JSON.parse(process.env.PINPOINT_CLONE_CONFIG);
assert.equal(cfg.supabaseUrl,'http://127.0.0.1:55431');assert.match(cfg.dbName,/^pinpoint-org-[0-9a-f-]{36}-db$/);
const spec=JSON.parse(execFileSync('docker',['inspect',cfg.dbName],{encoding:'utf8'}))[0];assert.match(spec.Config.Labels['pinpoint.organization.access.run'],/^pinpoint-org-[0-9a-f-]{36}$/);assert.deepEqual(spec.HostConfig.PortBindings,{});
const {createClient}=createRequire(path.join(cfg.sourceRoot,'package.json'))('@supabase/supabase-js');
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,cfg.supabaseUrl,'Blocked outside correction clone fetch');return realFetch(input,init);};
const client=key=>createClient(cfg.supabaseUrl,key??cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=client(cfg.serviceKey),anon=client(),accounts=[],actors=[],extraActors=[],checks=[],entries=[],factors=[];
const tag='entry-correction-'+randomUUID(),password='Fixture-'+randomUUID()+'aA1!',placeId=randomUUID();
let passed=false;
const evidence={environment:'patched disposable clone; genuine Auth TOTP/aal2, ordinary JWT REST/RPC and SQL; no cookie/browser or publication',tag,accounts,entries,factors,placeId,checks};
function sql(query){try{return execFileSync('docker',['exec','-i','-e',`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,'psql','-X','-q','-h','127.0.0.1','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw new Error(String(e.stderr??'').match(/ERROR:[^\r\n]*/)?.[0]??'SQL failed; arguments withheld');}}
const ok=r=>{assert.equal(r.error,null,JSON.stringify(r.error));return r.data;};
const denied=(r,code='42501')=>assert.equal(r.error?.code,code,JSON.stringify(r));
async function check(name,fn){await fn();checks.push({name});console.info('PASS',name);}
const authSnapshot=()=>sql(`select json_build_object('users',(select count(*) from auth.users),'sessions',(select count(*) from auth.sessions),'factors',(select count(*) from auth.mfa_factors),'factorFingerprint',(select md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')) from auth.mfa_factors t))`);
const authBefore=authSnapshot();
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){assert.ok(alphabet.includes(c));bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');}const bytes=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac('sha1',bytes).update(counter).digest();return ((digest.readUInt32BE(digest.at(-1)&15)&0x7fffffff)%1000000).toString().padStart(6,'0');}
async function enroll(actor,name){const data=ok(await actor.auth.mfa.enroll({factorType:'totp',friendlyName:name}));factors.push({userId:(await actor.auth.getUser()).data.user.id,id:data.id});const challenge=ok(await actor.auth.mfa.challenge({factorId:data.id}));ok(await actor.auth.mfa.verify({factorId:data.id,challengeId:challenge.id,code:totp(data.totp.secret)}));assert.equal(ok(await actor.auth.mfa.getAuthenticatorAssuranceLevel()).currentLevel,'aal2');return data.id;}
const read=(actor,entry)=>actor.rpc('pinpoint_entry_review_read',{category:entry.category,target:entry.id});
const reject=(actor,entry,version=entry.version,revision=entry.revisionId,reason='Synthetic correction')=>actor.rpc('pinpoint_entry_reject',{category:entry.category,target:entry.id,revision,expected_version:version,reason});
const state=entry=>sql(`select row_to_json(e)::text from public.pinpoint_entries e where id='${entry.id}'`);
const write=(actor,entry,command,expected,payload={},revision)=>actor.rpc('pinpoint_entry_write',{command,category:entry.category,target:entry.id,expected_version:expected,payload,...(revision?{revision}:{})});
try{
 assert.equal(sql('show cron.launch_active_jobs'),'off');assert.equal(sql('select count(*) from cron.job where active'),'0');
 for(let i=0;i<4;i++){const email=tag+'-'+i+'@pinpoint.invalid';const data=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Synthetic correction '+i}}));accounts.push({id:data.user.id,email});const id=data.user.id;sql(`update public.notification_subscriptions set enabled=false,frequency='never' where user_id='${id}' and channel='email';insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing;`);const actor=client();ok(await actor.auth.signInWithPassword({email,password}));actors.push(actor);}
 const [poster,reviewer,owner,ordinary]=actors;
 sql(`insert into public.discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north) values('${placeId}','${tag}','locality','Synthetic correction place','Fixture','Synthetic South African fixture',-33.96,18.47,18.4,-34.0,18.6,-33.9);insert into public.admin_memberships(user_id,level) values('${accounts[1].id}','admin'),('${accounts[2].id}','owner');`);
 for(const category of ['tourism','event']){ok(await poster.rpc('pinpoint_entry_enroll',{category}));const entry={id:randomUUID(),category,posterId:accounts[0].id,revisionId:randomUUID(),version:3};ok(await write(poster,entry,'create',0));entries.push(entry);ok(await write(poster,entry,'save',1,{title:'Synthetic '+category,description:'Private only',venueName:'Synthetic venue',areaId:placeId,address:'Synthetic address',latitude:-33.96,longitude:18.47,startsAt:'2035-10-03T08:30:00+02:00',endsAt:'2035-10-03T10:30:00+02:00'}));ok(await write(poster,entry,'submit',2,{},entry.revisionId));}
 const [entry,event]=entries;
 await check('Anonymous/service-role and ordinary/poster identities cannot read or correct a valid pending revision',async()=>{
  const before=state(entry);for(const actor of [anon,admin,poster,ordinary]){denied(await read(actor,entry));denied(await reject(actor,entry));}assert.equal(state(entry),before);
  denied(await anon.from('pinpoint_entry_corrections').select('*'));assert.deepEqual(ok(await ordinary.from('pinpoint_entry_corrections').select('*')),[]);
 });
 await check('Current admin and owner at genuine aal1 remain denied before MFA',async()=>{for(const actor of [reviewer,owner]){assert.equal(ok(await actor.auth.mfa.getAuthenticatorAssuranceLevel()).currentLevel,'aal1');denied(await read(actor,entry));denied(await reject(actor,entry));}});
 await check('Real verified admin TOTP establishes aal2 and reads the submitted snapshot without exposing private drafts',async()=>{
  await enroll(reviewer,tag+' admin');const view=ok(await read(reviewer,entry));assert.equal(view.entryId,entry.id);assert.equal(view.revisionId,entry.revisionId);assert.equal(view.posterId,accounts[0].id);
  assert.deepEqual(ok(await reviewer.from('pinpoint_entries').select('*').eq('id',entry.id)),[]);assert.deepEqual(ok(await reviewer.from('pinpoint_entry_revisions').select('*').eq('entry_id',entry.id)),[]);
  ok(await write(poster,entry,'save',3,{title:'Later private draft'}));entry.version=4;assert.equal(ok(await read(reviewer,entry)).content.title,'Synthetic tourism');
 });
 await check('Owner requires two genuinely verified factors, even after the first establishes aal2',async()=>{
  await enroll(owner,tag+' owner first');denied(await read(owner,entry));denied(await reject(owner,entry));const second=await enroll(owner,tag+' owner second');assert.equal(ok(await read(owner,event)).revisionId,event.revisionId);evidence.ownerSecondFactor=second;
 });
 await check('A new aal1 session with an already verified factor still cannot review',async()=>{const fresh=client();extraActors.push(fresh);ok(await fresh.auth.signInWithPassword({email:accounts[1].email,password}));assert.equal(ok(await fresh.auth.mfa.getAuthenticatorAssuranceLevel()).currentLevel,'aal1');denied(await read(fresh,entry));denied(await reject(fresh,entry));});
 await check('Membership revocation and suspension deny the existing real admin aal2 JWT without row changes',async()=>{
  const before=state(entry);sql(`update public.admin_memberships set revoked_at=clock_timestamp() where user_id='${accounts[1].id}';`);denied(await read(reviewer,entry));denied(await reject(reviewer,entry));assert.equal(state(entry),before);
  sql(`update public.admin_memberships set revoked_at=null where user_id='${accounts[1].id}';insert into public.account_suspensions(user_id,suspended_by,reason) values('${accounts[1].id}','${accounts[2].id}','${tag}');`);denied(await read(reviewer,entry));denied(await reject(reviewer,entry));assert.equal(state(entry),before);sql(`delete from public.account_suspensions where user_id='${accounts[1].id}' and reason='${tag}';`);ok(await read(reviewer,entry));
 });
 await check('Inactive category/account posters cannot be corrected; submitted investigation snapshot remains private to real MFA reviewer',async()=>{
  const before=state(entry);sql(`update public.entry_posters set revoked_at=clock_timestamp() where user_id='${accounts[0].id}' and category='tourism'`);assert.equal(ok(await read(reviewer,entry)).revisionId,entry.revisionId);denied(await reject(reviewer,entry));assert.equal(state(entry),before);sql(`update public.entry_posters set revoked_at=null where user_id='${accounts[0].id}' and category='tourism';insert into public.account_suspensions(user_id,suspended_by,reason) values('${accounts[0].id}','${accounts[2].id}','${tag}');`);denied(await reject(reviewer,entry));assert.equal(state(entry),before);sql(`delete from public.account_suspensions where user_id='${accounts[0].id}' and reason='${tag}';`);
 });
 await check('Wrong category/revision, blank reason and stale corrections are denied without rewriting content or history',async()=>{
  const before=state(entry);assert.equal(ok(await read(reviewer,{...entry,category:'event'})),null);denied(await reject(reviewer,{...entry,category:'event'}),'PT409');denied(await reject(reviewer,entry,entry.version,randomUUID()),'22023');denied(await reject(reviewer,entry,entry.version,entry.revisionId,' '),'22023');const stale=await reject(reviewer,entry,entry.version-1);assert.equal(stale.status,409);denied(stale,'PT409');assert.equal(state(entry),before);assert.equal(sql('select count(*) from public.pinpoint_entry_corrections'),'0');
 });
 await check('Genuine admin and owner concurrent corrections have exactly one winner and preserve immutable submitted content',async()=>{
  const frozen=sql(`select row_to_json(r)::text from public.pinpoint_entry_revisions r where id='${entry.revisionId}'`);const replies=await Promise.all([reject(reviewer,entry,entry.version,entry.revisionId,' Admin correction '),reject(owner,entry,entry.version,entry.revisionId,' Owner correction ')]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);evidence.concurrentCorrectionStatuses=replies.map(r=>r.status);
  const correction=JSON.parse(sql(`select row_to_json(c) from public.pinpoint_entry_corrections c where entry_id='${entry.id}'`));assert.ok([accounts[1].id,accounts[2].id].includes(correction.reviewer_id));assert.equal(correction.version,5);assert.equal(correction.revision_id,entry.revisionId);assert.ok(['Admin correction','Owner correction'].includes(correction.reason));assert.equal(sql(`select row_to_json(r)::text from public.pinpoint_entry_revisions r where id='${entry.revisionId}'`),frozen);assert.equal(JSON.parse(state(entry)).pending_revision_id,null);assert.equal(ok(await read(reviewer,entry)),null);
  assert.equal(ok(await poster.from('pinpoint_entry_corrections').select('*').eq('entry_id',entry.id)).length,1);assert.equal(ok(await reviewer.from('pinpoint_entry_corrections').select('*').eq('entry_id',entry.id)).length,1);assert.deepEqual(ok(await ordinary.from('pinpoint_entry_corrections').select('*')),[]);
 });
 await check('Direct correction INSERT/UPDATE/DELETE are revoked and privileged history changes also hit the immutable trigger',async()=>{
  const valid={entry_id:entry.id,revision_id:entry.revisionId,poster_id:accounts[0].id,category:entry.category,reviewer_id:accounts[1].id,version:5,reason:'Forged'};
  for(const actor of [poster,reviewer,ordinary]){denied(await actor.from('pinpoint_entry_corrections').insert(valid));denied(await actor.from('pinpoint_entry_corrections').update({reason:'Overwrite'}).eq('entry_id',entry.id).select('*'));denied(await actor.from('pinpoint_entry_corrections').delete().eq('entry_id',entry.id).select('*'));}
  for(const statement of [`update public.pinpoint_entry_corrections set reason='Overwrite' where entry_id='${entry.id}'`,`delete from public.pinpoint_entry_corrections where entry_id='${entry.id}'`]){let blocked=false;try{sql(statement);}catch(e){assert.match(e.message,/Entry history is immutable/);blocked=true;}assert.ok(blocked);}
 });
 await check('Withdrawn pending Event cannot be revived by delayed correction; renewal returns a fresh revision to private review',async()=>{
  ok(await write(poster,event,'withdraw',3));const before=state(event);denied(await reject(reviewer,event,4),'22023');assert.equal(state(event),before);assert.equal(ok(await read(reviewer,event)),null);const fresh=randomUUID();ok(await write(poster,event,'submit',4,{},fresh));event.revisionId=fresh;event.version=5;assert.equal(ok(await read(reviewer,event)).revisionId,fresh);const correction=ok(await reject(reviewer,event));assert.equal(correction.version,6);assert.equal(correction.pendingRevisionId,null);assert.equal(sql(`select count(*) from public.pinpoint_entry_revisions where entry_id='${event.id}'`),'2');
 });
 await check('Actual factor removal invalidates owner capability under the previously issued aal2 token',async()=>{ok(await owner.auth.mfa.unenroll({factorId:evidence.ownerSecondFactor}));denied(await read(owner,entry));denied(await reject(owner,entry));});
 await check('Scoped official read-only advisors find no new correction security warnings/errors or uncovered foreign keys',async()=>{
  const text=readFileSync(path.join(tmpdir(),'pinpoint-entry-advisors-2.109.0.sql'),'utf8');const hash=createHash('sha256').update(text).digest('hex');assert.equal(hash,'4566342793150742ca7bf539295d4175af4218761925927190fdec31315ae15c');const query=text.replace("set local search_path = '';",'').trim().replace(/;$/,'');const all=JSON.parse(sql(`begin read only;set local search_path='';set local pgrst.db_schemas='public';select coalesce(json_agg(row_to_json(l)),'[]') from (${query}) l;rollback;`));evidence.advisors={querySha256:hash,entryFindings:all.filter(x=>['entry_posters','pinpoint_entries','pinpoint_entry_revisions','pinpoint_entry_events','pinpoint_entry_corrections'].includes(x.metadata?.name)||String(x.metadata?.name??'').startsWith('pinpoint_entry_'))};assert.deepEqual(evidence.advisors.entryFindings.filter(x=>x.level!=='INFO'||x.name==='unindexed_foreign_keys'),[]);
 });
 passed=true;
}catch(error){evidence.failure={name:error.name,message:String(error.message).slice(0,2400)};console.error(evidence.failure);process.exitCode=1;}
finally{
 try{
  for(const actor of [...actors,...extraActors])await actor.auth.signOut().catch(()=>{});
  for(const account of accounts){assert.match(account.id,/^[0-9a-f-]{36}$/);assert.equal(sql(`select email from auth.users where id='${account.id}'`),account.email);assert.ok(account.email.startsWith(tag));}
  if(accounts.length){const ids=accounts.map(a=>`'${a.id}'`).join(',');for(const entry of entries)assert.equal(sql(`select poster_id||'|'||category from public.pinpoint_entries where id='${entry.id}'`),entry.posterId+'|'+entry.category);
   sql(`begin;alter table public.pinpoint_entry_corrections disable trigger pinpoint_entry_corrections_immutable;alter table public.pinpoint_entry_events disable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions disable trigger pinpoint_entry_revisions_immutable;delete from public.pinpoint_entry_corrections where poster_id in (${ids});delete from public.pinpoint_entry_events where poster_id in (${ids});update public.pinpoint_entries set pending_revision_id=null where poster_id in (${ids});delete from public.pinpoint_entry_revisions where poster_id in (${ids});delete from public.pinpoint_entries where poster_id in (${ids});delete from public.entry_posters where user_id in (${ids});alter table public.pinpoint_entry_corrections enable trigger pinpoint_entry_corrections_immutable;alter table public.pinpoint_entry_events enable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions enable trigger pinpoint_entry_revisions_immutable;delete from public.account_suspensions where user_id in (${ids}) and reason='${tag}';alter table public.admin_memberships disable trigger admin_memberships_last_owner;delete from public.admin_memberships where user_id in (${ids});alter table public.admin_memberships enable trigger admin_memberships_last_owner;delete from public.discovery_places where id='${placeId}' and provider_id='${tag}';commit;`);
   for(const account of accounts)ok(await admin.auth.admin.deleteUser(account.id));
  }
  assert.equal(authSnapshot(),authBefore);for(const table of ['entry_posters','pinpoint_entries','pinpoint_entry_revisions','pinpoint_entry_events','pinpoint_entry_corrections'])assert.equal(sql(`select count(*) from public.${table}`),'0');
  evidence.cleanup={capturedAccountsRemoved:accounts.map(a=>a.id),entriesRemoved:entries.map(e=>e.id),factorIdsRemoved:factors.map(f=>f.id),placeRemoved:placeId,immutableAndOwnerGuardTriggersRestored:true,authUserSessionFactorCountsAndFactorFingerprintRestored:true};
 }catch(error){passed=false;process.exitCode=1;evidence.cleanupFailure={name:error.name,message:String(error.message).slice(0,1600)};console.error(evidence.cleanupFailure);}
 evidence.recordedAt=new Date().toISOString();evidence.passed=passed;writeFileSync(cfg.resultPath,JSON.stringify(evidence,null,2)+'\n');
}
assert.ok(passed);
