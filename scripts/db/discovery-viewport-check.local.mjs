/** Runs only inside the labelled disposable clone harness. All fixtures roll back. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const cfg = JSON.parse(process.env.PINPOINT_CLONE_CONFIG ?? '{}');
assert.equal(cfg.supabaseUrl, 'http://127.0.0.1:55431');
const spec = JSON.parse(execFileSync('docker',['inspect',cfg.dbName],{encoding:'utf8'}))[0];
assert.ok(spec.Config.Labels['pinpoint.release.run']);
assert.deepEqual(spec.HostConfig.PortBindings,{});
const q = value => "'" + String(value).replaceAll("'","''") + "'";
function sql(query) {
  try { return execFileSync('docker',['exec','-i','-e',`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,'psql','-X','-h','127.0.0.1','-U','supabase_admin','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024}).trim(); }
  catch(error) { throw Error(String(error.stderr ?? '').match(/ERROR:[^\r\n]*/)?.[0] ?? 'Clone SQL check failed; credentials withheld'); }
}
const manifest = JSON.parse(readFileSync(cfg.sourceRoot+'/artifacts/demo-listings/2026-10-08/manifest.json'));
const owners = new Set(manifest.accounts.map(a=>a.id));
const original = readFileSync(cfg.sourceRoot+'/artifacts/demo-listings/2026-10-08/publication.sql','utf8').trim().replace(/^begin;/,'').replace(/commit;$/,'');
const statements = ['begin;'];
for (const a of manifest.accounts) statements.push(`insert into auth.users(id,instance_id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(${q(a.id)},'00000000-0000-0000-0000-000000000000',${q(a.email)},now(),'{}',${q(JSON.stringify({full_name:a.name,demo_batch:manifest.batch}))}::jsonb,now(),now());`);
statements.push(`insert into public.discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north) values(${q(manifest.areaId)},'clone-demo-rondebosch','neighbourhood','Rondebosch','Western Cape','Rondebosch, Cape Town',-33.968,18.485,18.45,-34,18.52,-33.93);`);
statements.push(original);
const checks = [];
function record(name,expression,role='anon') {
  statements.push(`set local role ${role}; select jsonb_build_object('name',${q(name)},'value',${expression}); reset role;`);
}
const rpc = (category,search='',sort=category==='service'?'Latest':'Ending soon',type='All services',bbox='18,-34,19,-33') => `public.pinpoint_discovery_viewport(${q(category)},${bbox},${q(search)},${q(sort)},${q(type)})`;
for (const category of ['shopping','tourism','event','service']) {
  record(category+' initial',rpc(category));
  record(category+' empty',rpc(category,'',undefined,undefined,'20,-30,21,-29'));
  record(category+' authenticated',rpc(category),'authenticated');
}
record('search',rpc('shopping','pastry'));
record('service type',rpc('service','','Latest','Plumbing'));
record('nearest',rpc('shopping','','Nearest'));
record('private helper closed',"has_function_privilege('anon','private.pinpoint_offer_public_snapshot(uuid,timestamptz)','execute')");
statements.push('savepoint hidden;');
statements.push(`update auth.users set banned_until=now()+interval '1 day' where id in (${[...owners].map(q).join(',')});`);
for(const category of ['shopping','tourism','event','service']) record(category+' suspended',rpc(category));
statements.push('rollback to hidden; release hidden; savepoint withdrawn;');
statements.push(`update public.shopping_offers set withdrawn_at=now() where poster_id in (${[...owners].map(q).join(',')}); update public.pinpoint_entries set withdrawn_at=now() where poster_id in (${[...owners].map(q).join(',')}); delete from public.approved_services where id in (select id from public.service_submissions where poster_id in (${[...owners].map(q).join(',')}));`);
for(const category of ['shopping','tourism','event','service']) record(category+' unpublished',rpc(category));
statements.push('rollback to withdrawn; release withdrawn;');
function timedCopy(prefix,start,end) {
  const ids = new Map();
  return original.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,id=>{
    if(owners.has(id)||id===manifest.areaId||id===manifest.batch) return id;
    if(!ids.has(id)) ids.set(id,randomUUID()); return ids.get(id);
  }).replaceAll('"title":"Demo','"title":"'+prefix+' Demo')
    .replace(/"startsAt":"[^"]+"/g,'"startsAt":"'+start+'"').replace(/"endsAt":"[^"]+"/g,'"endsAt":"'+end+'"');
}
statements.push(timedCopy('Expired','2000-01-01T00:00:00.000Z','2000-01-02T00:00:00.000Z'));
for(const category of ['shopping','tourism','event']) record(category+' expired',rpc(category,'Expired Demo'));
statements.push(timedCopy('Future','2100-01-01T00:00:00.000Z','2100-01-02T00:00:00.000Z'));
for(const category of ['shopping','tourism','event']) record(category+' future',rpc(category,'Future Demo'));
// More than a viewport's capacity, plus a searchable item ordered after the cap.
const provider = manifest.accounts.find(a=>a.kind==='services').id;
for(let i=0;i<252;i++) {
  const id = randomUUID();
  const content = { title:i===251?'Needle beyond cap':'Capacity '+i,providerName:'Clone fixture',serviceType:'Cleaning',description:'Disposable clone only',areaId:manifest.areaId,address:'Clone',latitude:-33.97,longitude:18.48,phone:'+27 00 000 0000' };
  statements.push(`insert into public.service_submissions(id,poster_id,version,status,draft,submitted) values(${q(id)},${q(provider)},1,'approved',${q(JSON.stringify(content))}::jsonb,${q(JSON.stringify(content))}::jsonb); insert into public.approved_services(id,area_id,content,approved_at) values(${q(id)},${q(manifest.areaId)},${q(JSON.stringify(content))}::jsonb,now()-interval '${i} seconds');`);
}
record('capacity',rpc('service','Capacity'));
record('search before cap',rpc('service','Needle beyond cap'));
record('service type before cap',rpc('service','','Latest','Plumbing'));
statements.push(`savepoint invalid; do $check$ begin begin perform ${rpc('service','','Ending soon')}; raise exception 'Invalid sort accepted'; exception when sqlstate '22023' then null; end; begin perform ${rpc('shopping','','Latest','All services','19,-34,18,-33')}; raise exception 'Invalid bounds accepted'; exception when sqlstate '22023' then null; end; end $check$; release invalid;`);
statements.push('rollback;');
const output = sql(statements.join('\n'));
const rows = output.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
for(const row of rows) {
  const v = row.value;
  if(row.name.endsWith(' initial')||row.name.endsWith(' authenticated')||row.name==='nearest') {
    assert.equal(v.totalCount,2,row.name); assert.equal(v.items.length,2,row.name);
    assert.equal(v.category,row.name.split(' ')[0]==='nearest'?'shopping':row.name.split(' ')[0]);
    assert(!JSON.stringify(v).includes('reviewer_id')); assert(!JSON.stringify(v).includes('verification_note'));
    if(v.category==='event') assert.equal(v.items.filter(i=>i.state==='upcoming').length,1);
  } else if(/ empty$| suspended$| unpublished$| expired$/.test(row.name)||['shopping future','tourism future'].includes(row.name)) assert.equal(v.totalCount,0,row.name);
  else if(row.name==='private helper closed') assert.equal(v,false);
  else if(row.name==='capacity') { assert.equal(v.totalCount,251); assert.equal(v.items.length,250); }
  else if(row.name==='event future') { assert.equal(v.totalCount,2); assert(v.items.every(i=>i.state==='upcoming')); }
  else if(row.name==='service type before cap') { assert.equal(v.totalCount,3); assert(v.items.every(i=>i.content.serviceType==='Plumbing')); }
  else assert.equal(v.totalCount,1,row.name);
  checks.push(row.name+': passed');
}
assert.equal(rows.length,33);
// Genuine PostgREST anonymous RPC wiring, with no fixtures committed.
const response = await fetch(cfg.supabaseUrl+'/rest/v1/rpc/pinpoint_discovery_viewport',{method:'POST',headers:{apikey:cfg.anonKey,Authorization:'Bearer '+cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({category:'shopping',west:18,south:-34,east:19,north:-33})});
assert.equal(response.status,200); assert.equal((await response.json()).totalCount,0); checks.push('Anonymous PostgREST viewport RPC: passed');
const rollback=readFileSync(cfg.sourceRoot+'/artifacts/discovery-viewport-20261008/rollback.sql','utf8').replace(/commit;\s*$/,'');
const reverted=sql(rollback+"select json_build_object('readerRemoved',to_regprocedure('public.pinpoint_discovery_viewport(text,double precision,double precision,double precision,double precision,text,text,text)') is null,'shoppingRemoved',to_regprocedure('public.pinpoint_shopping_viewport(double precision,double precision,double precision,double precision,text,text)') is null); rollback;");
assert.deepEqual(JSON.parse(reverted),{readerRemoved:true,shoppingRemoved:true});
checks.push('Rollback removes only the new readers; transaction restored: passed');
writeFileSync(cfg.resultPath,JSON.stringify({checks,passed:true,fixtureTransactionsRolledBack:true,cloneOnly:true},null,2));
console.log('Viewport clone checks passed: '+checks.length);
