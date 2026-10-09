import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
const cfg=JSON.parse(process.env.PINPOINT_CLONE_CONFIG);
assert.equal(cfg.supabaseUrl,'http://127.0.0.1:55431');
assert.match(cfg.dbName,/^pinpoint-org-[0-9a-f-]{36}-db$/);
const spec=JSON.parse(execFileSync('docker',['inspect',cfg.dbName],{encoding:'utf8'}))[0];
assert.match(spec.Config.Labels['pinpoint.organization.access.run'],/^pinpoint-org-[0-9a-f-]{36}$/);
assert.deepEqual(spec.HostConfig.PortBindings,{});
const {createClient}=createRequire(path.join(cfg.sourceRoot,'package.json'))('@supabase/supabase-js');
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(u.origin,cfg.supabaseUrl,'Blocked outside intake fixture fetch');return realFetch(input,init);};
const client=key=>createClient(cfg.supabaseUrl,key??cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=client(cfg.serviceKey),anon=client();
const tag='entry-intake-'+randomUUID(),password='Fixture-'+randomUUID()+'aA1!';
const accounts=[],actors=[],checks=[],entries=[],revisions=[],placeId=randomUUID();
let passed=false;
const evidence={environment:'disposable patched clone; real Auth/REST/RPC/SQL persistence and session-backed private workspace browser flow; no approval or public journey',tag,accounts,entries,revisions,placeId,checks,browserFlows:[]};
let appServer,browser;
function sql(query){try{return execFileSync('docker',['exec','-i','-e',`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,'psql','-X','-h','127.0.0.1','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch(e){const diag=String(e.stderr??'').match(/ERROR:[^\r\n]*/)?.[0]??'No SQL diagnostic';throw new Error(diag);}}
async function check(name,fn){await fn();checks.push({name});console.info('PASS',name);}
function ok(result){assert.equal(result.error,null,JSON.stringify(result.error));return result.data;}
function denied(result,code='42501'){assert.equal(result.error?.code,code,JSON.stringify(result));}
function state(id){return sql(`select row_to_json(e)::text from public.pinpoint_entries e where id='${id}'`);}
function write(actor,entry,command,expected,payload={},revision){return actor.rpc('pinpoint_entry_write',{command,category:entry.category,target:entry.id,expected_version:expected,payload,...(revision?{revision}:{})});}
const content=category=>({title:' Synthetic '+category+' ',description:'Private fixture, no real venue or authority',venueName:'Synthetic venue',areaId:placeId,address:'Synthetic public address',latitude:-33.96,longitude:18.47,startsAt:'2035-10-03T08:30:00+02:00',endsAt:'2035-10-03T10:30:00+02:00'});
const tables=['entry_posters','pinpoint_entries','pinpoint_entry_revisions','pinpoint_entry_events'];
try{
 assert.equal(sql('show cron.launch_active_jobs'),'off');assert.equal(sql('select count(*) from cron.job where active'),'0');
 assert.equal(sql(`select count(*) from public.pinpoint_entries`),'0');
 for(let i=0;i<4;i++){
  const email=tag+'-'+i+'@pinpoint.invalid';const created=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Synthetic entry '+i}}));
  accounts.push({id:created.user.id,email});const id=created.user.id;
  sql(`update public.profiles set role='renter',email_verified_at=clock_timestamp() where id='${id}';update public.notification_subscriptions set enabled=false,frequency='never' where user_id='${id}' and channel='email';insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing;`);
  const actor=client();ok(await actor.auth.signInWithPassword({email,password}));actors.push(actor);
 }
 sql(`insert into public.discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north) values('${placeId}','${tag}','locality','Synthetic private entry place','Fixture','Synthetic South African fixture',-33.96,18.47,18.4,-34.0,18.6,-33.9);`);
 const [poster,foreign,offerOnly,ordinary]=actors;
 await check('Anonymous and service-role calls cannot enroll, read capability or write entries; no anonymous table reads',async()=>{
  for(const actor of [anon,admin])for(const name of ['pinpoint_entry_enroll','pinpoint_entry_poster'])denied(await actor.rpc(name,{category:'tourism'}));
  for(const actor of [anon,admin])denied(await actor.rpc('pinpoint_entry_write',{command:'create',category:'tourism',target:randomUUID(),expected_version:0}));
  for(const table of tables)denied(await anon.from(table).select('*'));
 });
 await check('Offer enrollment and Property renter role confer no Tourism/Event capability; category enrollment is explicit and idempotent',async()=>{
  ok(await offerOnly.rpc('pinpoint_offer_enroll',{}));
  for(const actor of actors)for(const category of ['tourism','event'])denied(await actor.rpc('pinpoint_entry_poster',{category}));
  for(const actor of [poster,foreign])for(const category of ['tourism','event']){
   const first=ok(await actor.rpc('pinpoint_entry_enroll',{category}));const second=ok(await actor.rpc('pinpoint_entry_enroll',{category}));assert.deepEqual(first,second);assert.equal(first.userId,(await actor.auth.getUser()).data.user.id);assert.equal(first.category,category);assert.equal(first.revokedAt,null);
  }
  assert.equal(sql(`select count(*) from public.pinpoint_entry_events where action='enroll'`),'4');
  denied(await ordinary.rpc('pinpoint_entry_enroll',{category:'offer'}),'22023');
  denied(await offerOnly.rpc('pinpoint_entry_write',{command:'create',category:'tourism',target:randomUUID(),expected_version:0}));
 });
 await check('Fresh current Auth records deny unconfirmed, anonymous and deleted-session accounts despite a previously valid JWT',async()=>{
  const id=accounts[3].id;
  const stamp=sql(`select to_json(email_confirmed_at) from auth.users where id='${id}'`);
  sql(`update auth.users set email_confirmed_at=null where id='${id}'`);denied(await ordinary.rpc('pinpoint_entry_enroll',{category:'event'}));
  sql(`update auth.users set email_confirmed_at=${JSON.parse(stamp)?"'"+JSON.parse(stamp)+"'::timestamptz":'null'},is_anonymous=true where id='${id}'`);denied(await ordinary.rpc('pinpoint_entry_enroll',{category:'event'}));
  sql(`update auth.users set is_anonymous=false where id='${id}'`);
  const priorSession=ok(await ordinary.auth.getSession()).session;ok(await ordinary.auth.signOut());
  const expiredSession=await fetch(cfg.supabaseUrl+'/rest/v1/rpc/pinpoint_entry_enroll',{method:'POST',headers:{apikey:cfg.anonKey,Authorization:'Bearer '+priorSession.access_token,'Content-Type':'application/json'},body:JSON.stringify({category:'event'})});
  assert.equal(expiredSession.status,403);assert.equal((await expiredSession.json()).code,'42501');
 });
 await check('Both categories persist owner drafts and UTC times; direct inserts/updates/deletes remain revoked for all ordinary identities',async()=>{
  for(const category of ['tourism','event']){
   const entry={id:randomUUID(),category,posterId:accounts[0].id};entries.push(entry);
   assert.equal(ok(await write(poster,entry,'create',0)).version,1);assert.equal(ok(await write(poster,entry,'save',1,content(category))).version,2);
   const row=JSON.parse(state(entry.id));assert.equal(row.draft.startsAt,'2035-10-03T06:30:00.000Z');assert.equal(row.draft.endsAt,'2035-10-03T08:30:00.000Z');assert.equal(row.draft.title,'Synthetic '+category);assert.equal(row.poster_id,accounts[0].id);assert.equal(row.category,category);
  }
  const validRows={entry_posters:{user_id:accounts[0].id,category:'tourism'},pinpoint_entries:{id:randomUUID(),poster_id:accounts[0].id,category:'tourism'},pinpoint_entry_revisions:{id:randomUUID(),entry_id:entries[0].id,poster_id:accounts[0].id,category:'tourism',content:content('tourism')},pinpoint_entry_events:{poster_id:accounts[0].id,category:'tourism',actor_id:accounts[0].id,action:'enroll'}};
  for(const actor of [poster,foreign,offerOnly])for(const table of tables){
   const scopeColumn=table==='entry_posters'?'user_id':'poster_id';
   denied(await actor.from(table).insert(validRows[table]));denied(await actor.from(table).update({category:'event'}).eq(scopeColumn,accounts[0].id).select('*'));denied(await actor.from(table).delete().eq(scopeColumn,accounts[0].id).select('*'));
  }
 });
 const entry=entries[0],event=entries[1];
 await check('Foreign and unenrolled identities cannot read or mutate another poster; category cannot be switched',async()=>{
  const before=state(entry.id);
  for(const actor of [foreign,offerOnly]){
   for(const table of ['pinpoint_entries','pinpoint_entry_revisions','pinpoint_entry_events'])assert.deepEqual(ok(await actor.from(table).select('*').eq(table==='pinpoint_entries'?'id':'entry_id',entry.id)),[]);
   for(const command of ['save','submit','withdraw'])denied(await write(actor,entry,command,2,command==='save'?{title:'Foreign'}:{},command==='submit'?randomUUID():undefined));
  }
  denied(await write(poster,{...entry,category:'event'},'save',2,{title:'Switched'}));assert.equal(state(entry.id),before);
 });
 await check('Forged capability/publication fields, malformed dates and invalid content are rejected with the entire row unchanged',async()=>{
  const before=state(entry.id);
  for(const payload of [{canPost:true},{posterId:accounts[1].id},{approved:true},{weeklyRecurrence:[]},{mediaUrl:'https://example.invalid/asset'},[],null,{title:''},{description:'x'.repeat(4001)},{latitude:91},{longitude:'18.47'},{areaId:'not-uuid'},{startsAt:'2035-10-03T08:30:00'},{startsAt:'2035-02-30T08:30:00Z'},{endsAt:'2035-10-03T24:00:00Z'}]){
   denied(await write(poster,entry,'save',2,payload),'22023');assert.equal(state(entry.id),before);
  }
  denied(await write(poster,entry,'submit',2,{canReview:true},randomUUID()),'22023');assert.equal(state(entry.id),before);
 });
 await check('Incomplete, reversed, equal, ended and unrelated-place submissions fail; no failed submission leaves a revision/event',async()=>{
  const probes=[{title:'Incomplete'},{...content('tourism'),endsAt:'2035-10-03T08:29:59+02:00'},{...content('tourism'),endsAt:content('tourism').startsAt},{...content('tourism'),startsAt:'2000-01-01T00:00:00Z',endsAt:'2000-01-02T00:00:00Z'},{...content('tourism'),areaId:randomUUID()},{...content('tourism'),latitude:0}];
  for(const payload of probes){const version=JSON.parse(state(entry.id)).version;ok(await write(poster,entry,'save',version,payload));const before=state(entry.id),revision=randomUUID();denied(await write(poster,entry,'submit',version+1,{},revision),'22023');assert.equal(state(entry.id),before);assert.equal(sql(`select count(*) from public.pinpoint_entry_revisions where id='${revision}'`),'0');}
  const version=JSON.parse(state(entry.id)).version;ok(await write(poster,entry,'save',version,content('tourism')));
 });
 await check('Actual HTTP stale and competing versioned saves return 409 with exactly one winner',async()=>{
  const {data:{session}}=await poster.auth.getSession();const headers={apikey:cfg.anonKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
  const send=(version,title)=>fetch(cfg.supabaseUrl+'/rest/v1/rpc/pinpoint_entry_write',{method:'POST',headers,body:JSON.stringify({command:'save',category:entry.category,target:entry.id,expected_version:version,payload:{...content('tourism'),title}})});
  const version=JSON.parse(state(entry.id)).version,before=state(entry.id);const stale=await send(version-1,'Stale');assert.equal(stale.status,409);assert.equal((await stale.json()).code,'PT409');assert.equal(state(entry.id),before);
  const results=await Promise.all(['Winner A','Winner B'].map(title=>send(version,title)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);evidence.concurrentSaveStatuses=results.map(r=>r.status);
  const row=JSON.parse(state(entry.id));assert.equal(row.version,version+1);assert.ok(['Winner A','Winner B'].includes(row.draft.title));
 });
 await check('Submissions freeze both category revisions; private draft edits do not rewrite snapshots; reused/pending submission is denied',async()=>{
  for(const target of [entry,event]){
   const version=JSON.parse(state(target.id)).version,revision=randomUUID();revisions.push({id:revision,entryId:target.id});const result=ok(await write(poster,target,'submit',version,{},revision));assert.equal(result.pendingRevisionId,revision);
   const frozen=sql(`select row_to_json(r)::text from public.pinpoint_entry_revisions r where id='${revision}'`);
   denied(await write(poster,target,'submit',version+1,{},randomUUID()),'22023');ok(await write(poster,target,'save',version+1,{...content(target.category),title:'Private change'}));assert.equal(sql(`select row_to_json(r)::text from public.pinpoint_entry_revisions r where id='${revision}'`),frozen);
   const rows=ok(await poster.from('pinpoint_entry_revisions').select('*').eq('id',revision));assert.equal(rows.length,1);assert.equal(rows[0].poster_id,accounts[0].id);
  }
  for(const table of ['pinpoint_entry_revisions','pinpoint_entry_events']){
   for(const verb of ['update','delete']){let blocked=false;try{sql(`${verb==='update'?`update public.${table} set category=category`:`delete from public.${table}`} where entry_id='${entry.id}'`);}catch(e){assert.match(e.message,/Entry history is immutable/);blocked=true;}assert.ok(blocked);}
  }
 });
 await check('Withdrawal is version checked, retains history, and renewal requires a fresh immutable revision',async()=>{
  const version=JSON.parse(state(entry.id)).version;const oldRevision=revisions[0].id;const result=ok(await write(poster,entry,'withdraw',version));assert.equal(result.pendingRevisionId,null);assert.equal(result.version,version+1);
  denied(await write(poster,entry,'withdraw',version),'PT409');assert.equal(ok(await write(poster,entry,'withdraw',version+1)).version,version+1);
  denied(await write(poster,entry,'submit',version+1,{},oldRevision),'22023');const fresh=randomUUID();revisions.push({id:fresh,entryId:entry.id});const renewed=ok(await write(poster,entry,'submit',version+1,{},fresh));assert.equal(renewed.pendingRevisionId,fresh);assert.equal(sql(`select count(*) from public.pinpoint_entry_revisions where entry_id='${entry.id}'`),'2');
 });
 await check('Native desktop cookie flow creates, edits, reloads, submits, preserves the immutable snapshot, and withdraws Tourism and Event drafts',async()=>{
  const appEnv={...process.env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:cfg.supabaseUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:cfg.anonKey,SUPABASE_SERVICE_ROLE_KEY:cfg.serviceKey,NEXT_PUBLIC_TURNSTILE_SITE_KEY:'',PORT:'3116'};
  delete appEnv.PINPOINT_CLONE_CONFIG;
  appServer=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3116'],{cwd:cfg.sourceRoot,env:appEnv,stdio:'ignore',windowsHide:true});
  let appReady=false;
  for(let attempt=0;attempt<180;attempt++){
   if(appServer.exitCode!==null)throw new Error('Isolated Next development server exited before browser checks');
   try{const response=await realFetch('http://127.0.0.1:3116/auth');if(response.ok){appReady=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(appReady,'Isolated Next server did not become ready');
  const {chromium}=createRequire(path.join(cfg.sourceRoot,'package.json'))('@playwright/test');
  browser=await chromium.launch({headless:true});
  const desktop=await browser.newContext({viewport:{width:1280,height:900}}),page=await desktop.newPage();page.setDefaultTimeout(30000);
  const signIn=async(target)=>{
   await page.goto(`http://localhost:3116/auth?redirect=${encodeURIComponent(target)}`);
   await page.locator('input[name="email"]').fill(accounts[0].email);await page.locator('#auth-password').fill(password);
   await page.getByRole('button',{name:'Sign in'}).click();
   await page.waitForURL(`**${target}`,{timeout:90000});
  };
  const createAndExercise=async(category)=>{
   const target=`/post/entries/${category}`;await page.goto(`http://localhost:3116${target}`);
   const createLabel=category==='event'?'New Event':'New Tourism entry';
   await page.getByRole('button',{name:createLabel}).click();
   await page.waitForURL(new RegExp(`/post/entries/${category}/[0-9a-f-]{36}$`),{timeout:30000});
   const id=new URL(page.url()).pathname.split('/').at(-1);assert.match(id,/^[0-9a-f-]{36}$/);entries.push({id,category,posterId:accounts[0].id,browser:true});
   await page.getByLabel('Entry title').fill(`Browser ${category} draft`);
   await page.getByLabel('Description').fill('Synthetic browser fixture. No real place, business or authority claim.');
   await page.getByLabel('Venue name').fill('Synthetic browser venue');
   await page.getByRole('button',{name:/Location: Choose a location/}).click();
   await page.getByRole('combobox',{name:'Search South African locations'}).fill('Synthetic private entry place');
   await page.getByRole('option',{name:/Synthetic private entry place/}).click();
   await page.getByLabel('Street address').fill('Synthetic browser address');
   await page.getByLabel('Venue latitude').fill('-33.96');await page.getByLabel('Venue longitude').fill('18.47');
   await page.getByLabel('Starts at (SAST)').fill('2035-10-03T08:30');await page.getByLabel('Ends at (SAST)').fill('2035-10-03T10:30');
   await page.getByRole('button',{name:'Save private draft'}).click();
   await page.getByRole('status').filter({hasText:'Private draft saved.'}).waitFor();
   let row=JSON.parse(state(id));assert.equal(row.version,2);assert.equal(row.draft.title,`Browser ${category} draft`);assert.equal(row.draft.startsAt,'2035-10-03T06:30:00.000Z');
   await page.reload();assert.equal(await page.getByLabel('Entry title').inputValue(),`Browser ${category} draft`);
   await page.getByRole('button',{name:'Submit for review'}).click();
   await page.getByRole('status').filter({hasText:'Submitted for admin review.'}).waitFor();
   row=JSON.parse(state(id));assert.ok(row.pending_revision_id);const revisionId=row.pending_revision_id;revisions.push({id:revisionId,entryId:id,browser:true});
   const submitted=sql(`select content::text from public.pinpoint_entry_revisions where id='${revisionId}'`);
   assert.ok(JSON.parse(submitted).title===`Browser ${category} draft`);
   await page.getByLabel('Entry title').fill(`Later private ${category} edit`);await page.getByRole('button',{name:'Save private draft'}).click();
   await page.getByRole('status').filter({hasText:'Private draft saved.'}).waitFor();
   assert.equal(sql(`select content::text from public.pinpoint_entry_revisions where id='${revisionId}'`),submitted);
   await page.getByRole('button',{name:'Withdraw entry'}).click();await page.getByRole('button',{name:'Confirm withdrawal'}).click();
   await page.getByRole('status').filter({hasText:'Entry withdrawn.'}).waitFor();row=JSON.parse(state(id));
   assert.equal(row.pending_revision_id,null);assert.ok(row.withdrawn_at);assert.equal(sql(`select count(*) from public.pinpoint_entry_revisions where id='${revisionId}'`),'1');
   evidence.browserFlows.push({category,entryId:id,revisionId,persistedReload:true,submissionImmutable:true,withdrawalRetainedRevision:true});
   return id;
  };
  await signIn('/post/entries/tourism');
  const tourismId=await createAndExercise('tourism');
  const eventId=await createAndExercise('event');
  const phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,storageState:await desktop.storageState()});
  const phonePage=await phone.newPage();phonePage.setDefaultTimeout(30000);await phonePage.goto(`http://localhost:3116/post/entries/event/${eventId}`);
  assert.equal(await phonePage.getByLabel('Entry title').inputValue(),'Later private event edit');await phonePage.reload();
  assert.equal(await phonePage.getByLabel('Entry title').inputValue(),'Later private event edit');
  const width=await phonePage.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth}));assert.ok(width.document<=width.viewport,JSON.stringify(width));
  const screenshotPath=path.join(cfg.sourceRoot,'docs',`pinpoint-entry-workspace-phone-${tag.slice(-8)}.png`);
  await phonePage.screenshot({path:screenshotPath,fullPage:true});evidence.browserScreenshot=screenshotPath;
  evidence.browserFlows.push({device:'390x844',category:'event',persistedCookieAcrossContext:true,persistedReload:true,horizontalOverflow:false,screenshot:screenshotPath});
  const foreignContext=await browser.newContext(),foreignPage=await foreignContext.newPage();foreignPage.setDefaultTimeout(30000);
  await foreignPage.goto(`http://localhost:3116/auth?redirect=${encodeURIComponent(`/post/entries/tourism/${tourismId}`)}`);
  await foreignPage.locator('input[name="email"]').fill(accounts[1].email);await foreignPage.locator('#auth-password').fill(password);await foreignPage.getByRole('button',{name:'Sign in'}).click();
  await foreignPage.waitForURL(`**/post/entries/tourism/${tourismId}`,{timeout:90000});
  const beforeForeign=state(tourismId),foreignRow=JSON.parse(beforeForeign);
  const foreignRead=await foreignPage.goto(`http://localhost:3116/post/entries/tourism/${tourismId}`);assert.equal(foreignRead?.status(),404);
  const foreignWrite=await foreignPage.evaluate(async input=>{const response=await fetch('/api/private/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};},{command:'save',entryId:tourismId,category:'tourism',expectedVersion:foreignRow.version,draft:{title:'Foreign overwrite'}});
  assert.equal(foreignWrite.status,403);assert.equal(state(tourismId),beforeForeign);
  evidence.browserFlows.push({foreignAccount:accounts[1].id,entryId:tourismId,privateReadStatus:404,writeStatus:foreignWrite.status,rowUnchanged:true});
  await foreignContext.close();await phone.close();
  sql(`update public.entry_posters set revoked_at=clock_timestamp() where user_id='${accounts[0].id}' and category='tourism'`);
  const beforeRevoked=state(tourismId),revokedVersion=JSON.parse(beforeRevoked).version;
  const revokedWrite=await page.evaluate(async input=>{const response=await fetch('/api/private/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};},{command:'save',entryId:tourismId,category:'tourism',expectedVersion:revokedVersion,draft:{title:'Revoked overwrite'}});
  assert.equal(revokedWrite.status,403);assert.equal(state(tourismId),beforeRevoked);
  const revokedList=await page.goto('http://localhost:3116/post/entries/tourism');assert.equal(revokedList?.status(),200);assert.ok(await page.getByText('Access to this category has been revoked.').count());
  const activeOtherCategory=await page.goto('http://localhost:3116/post/entries/event');assert.equal(activeOtherCategory?.status(),200);assert.ok(await page.getByText('Browser event draft').count());
  evidence.browserFlows.push({category:'tourism',revokedSessionWriteStatus:revokedWrite.status,revokedEntryWriteRowUnchanged:true,otherCategoryStillAvailable:true});
  await desktop.close();
 });
 await check('Category revocation and account suspension deny existing JWTs and leave prior entry data unchanged',async()=>{
  const before=state(entry.id),id=accounts[0].id;
  sql(`update public.entry_posters set revoked_at=clock_timestamp() where user_id='${id}' and category='tourism'`);
  denied(await poster.rpc('pinpoint_entry_poster',{category:'tourism'}));denied(await poster.rpc('pinpoint_entry_enroll',{category:'tourism'}));denied(await write(poster,entry,'save',JSON.parse(before).version,{title:'Revoked'}));assert.deepEqual(ok(await poster.from('pinpoint_entries').select('*').eq('id',entry.id)),[]);assert.equal(state(entry.id),before);
  ok(await poster.rpc('pinpoint_entry_poster',{category:'event'}));
  sql(`insert into public.account_suspensions(user_id,suspended_by,reason) values('${id}','${accounts[1].id}','${tag}');`);
  const eventBefore=state(event.id);denied(await poster.rpc('pinpoint_entry_poster',{category:'event'}));denied(await write(poster,event,'withdraw',JSON.parse(eventBefore).version));assert.equal(state(event.id),eventBefore);
  sql(`delete from public.account_suspensions where user_id='${id}' and reason='${tag}';`);ok(await poster.rpc('pinpoint_entry_poster',{category:'event'}));
 });
 await check('No review/approval/evidence/publication endpoint is exposed; catalog confirms explicit ACLs, empty search paths and RLS',async()=>{
  for(const name of ['pinpoint_entry_approve','pinpoint_entry_publication_evidence','pinpoint_entry_reject'])denied(await poster.rpc(name,{target:entry.id}),'PGRST202');
  evidence.functionSecurity=JSON.parse(sql(`select json_agg(json_build_object('name',n.nspname||'.'||p.proname,'definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'pinpoint_entry_%' and n.nspname in ('public','private')`));
  for(const fn of evidence.functionSecurity){assert.deepEqual(fn.settings,['search_path=""']);if(fn.name.startsWith('public.'))assert.equal(fn.definer,false);assert.ok(!fn.acl.some(s=>s.startsWith('=')||s.startsWith('anon=')));}
  evidence.tableSecurity=JSON.parse(sql(`select json_agg(json_build_object('name',relname,'rls',relrowsecurity,'acl',relacl) order by relname) from pg_class where relnamespace='public'::regnamespace and relname in ('entry_posters','pinpoint_entries','pinpoint_entry_revisions','pinpoint_entry_events')`));
  for(const table of evidence.tableSecurity)assert.equal(table.rls,true);
 });
 passed=true;
}catch(error){evidence.failure={name:error.name,message:String(error.message).slice(0,2200)};console.error(evidence.failure);process.exitCode=1;}
finally{
 try{
  if(browser)await browser.close();
  if(appServer){try{appServer.kill();if(process.platform==='win32'&&appServer.pid)execFileSync('taskkill',['/PID',String(appServer.pid),'/T','/F'],{stdio:'ignore'});}catch{}}
  for(const actor of actors)await actor.auth.signOut().catch(()=>{});
  for(const a of accounts){assert.match(a.id,/^[0-9a-f-]{36}$/);assert.equal(sql(`select email from auth.users where id='${a.id}'`),a.email);assert.ok(a.email.startsWith(tag));}
  if(accounts.length){const ids=accounts.map(a=>`'${a.id}'`).join(',');
   for(const entry of entries){assert.equal(sql(`select poster_id||'|'||category from public.pinpoint_entries where id='${entry.id}'`),entry.posterId+'|'+entry.category);}
   sql(`begin;alter table public.pinpoint_entry_events disable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions disable trigger pinpoint_entry_revisions_immutable;delete from public.pinpoint_entry_events where poster_id in (${ids});update public.pinpoint_entries set pending_revision_id=null where poster_id in (${ids});delete from public.pinpoint_entry_revisions where poster_id in (${ids});delete from public.pinpoint_entries where poster_id in (${ids});delete from public.entry_posters where user_id in (${ids});alter table public.pinpoint_entry_events enable trigger pinpoint_entry_events_immutable;alter table public.pinpoint_entry_revisions enable trigger pinpoint_entry_revisions_immutable;alter table public.shopping_offer_events disable trigger shopping_offer_events_immutable;delete from public.shopping_offer_events where poster_id in (${ids}) and action='enroll';delete from public.offer_posters where user_id in (${ids});alter table public.shopping_offer_events enable trigger shopping_offer_events_immutable;delete from public.account_suspensions where user_id in (${ids}) and reason='${tag}';delete from public.discovery_places where id='${placeId}' and provider_id='${tag}';commit;`);
   for(const a of accounts)ok(await admin.auth.admin.deleteUser(a.id));
   for(const table of tables)assert.equal(sql(`select count(*) from public.${table}`),'0');
  }
  evidence.cleanup={capturedAccountsRemoved:accounts.map(a=>a.id),entriesRemoved:entries.map(e=>e.id),revisionHistoryRemoved:revisions.map(r=>r.id),placeRemoved:placeId,immutableTriggersRestored:true};
 }catch(error){passed=false;process.exitCode=1;evidence.cleanupFailure={name:error.name,message:String(error.message).slice(0,1600)};console.error(evidence.cleanupFailure);}
 evidence.passed=passed;evidence.recordedAt=new Date().toISOString();writeFileSync(cfg.resultPath,JSON.stringify(evidence,null,2)+'\n');
}
assert.ok(passed);
