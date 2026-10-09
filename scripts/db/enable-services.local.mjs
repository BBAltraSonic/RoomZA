/** Opt-in enablement of the verified Services schema and local TOTP. Never resets the stack. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import http from 'node:http';
if(process.env.PINPOINT_SERVICES_ENABLE_LOCAL!=='1')throw new Error('Explicit local Services enablement is required');
const local=parseEnv(readFileSync('.env.local','utf8'));assert.equal(local.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:54321');
const verified=JSON.parse(readFileSync('docs/pinpoint-services-local-evidence.json','utf8'));assert.equal(verified.passed,true);assert.deepEqual(verified.cloneCrashLogCheck.markers,[]);
const migrationPath='supabase/migrations/20261003081807_pinpoint_local_services.sql',migration=readFileSync(migrationPath,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');assert.equal(hash(migration),verified.sourceHashes[migrationPath]);
const docker=args=>{try{return execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true}).trim()}catch{throw new Error('Local Docker operation failed; arguments withheld')}};
const inspect=name=>JSON.parse(docker(['inspect',name]))[0];
const db=inspect('supabase_db_roomza'),auth=inspect('supabase_auth_roomza');assert.equal(db.Config.Image,'public.ecr.aws/supabase/postgres:17.6.1.111');assert.equal(auth.Config.Image,'public.ecr.aws/supabase/gotrue:v2.189.0');
const dbPassword=db.Config.Env.find(v=>v.startsWith('POSTGRES_PASSWORD=')).slice('POSTGRES_PASSWORD='.length);
function sql(query){try{return execFileSync('docker',['exec','-i','-e','PGPASSWORD='+dbPassword,'supabase_db_roomza','psql','-q','-X','-h','127.0.0.1','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true}).trim()}catch{throw new Error('Local SQL operation failed; query arguments withheld')}}
const existingTables=JSON.parse(sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='public'"));assert.ok(!existingTables.includes('service_submissions'));
const counts=()=>JSON.parse(sql('select json_object_agg(name,total) from ('+[...existingTables.map(t=>{assert.match(t,/^[a-z_]+$/);return `select '${t}' as name,count(*) as total from public.${t}`;}),"select 'auth_users',count(*) from auth.users","select 'auth_sessions',count(*) from auth.sessions","select 'auth_factors',count(*) from auth.mfa_factors","select 'storage_objects',count(*) from storage.objects"].join(' union all ')+') t'));
const protectedHashes=()=>JSON.parse(sql('select json_object_agg(name,digest) from ('+['listings','listing_images','user_favorites','applications','viewings','conversations','messages'].map(t=>`select '${t}' as name,md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')) as digest from public.${t} t`).join(' union all ')+') t'));
const jobs=()=>sql('select coalesce(json_agg(row_to_json(j) order by jobid),\'[]\') from cron.job j');
const allNames=docker(['ps','--format','{{.Names}}']).split(/\r?\n/).filter(n=>/^supabase_.*_roomza$/.test(n)&&n!=='supabase_auth_roomza');const originalIds=Object.fromEntries(allNames.map(n=>[n,inspect(n).Id]));
const before={counts:counts(),protectedHashes:protectedHashes(),jobs:jobs()};const configPath='supabase/config.toml',configBefore=readFileSync(configPath,'utf8');assert.ok(!configBefore.includes('[auth.mfa.totp]'));
const host=docker(['context','inspect','--format','{{.Endpoints.docker.Host}}']);assert.equal(host,'npipe:////./pipe/dockerDesktopLinuxEngine');const socketPath='\\\\.\\pipe\\dockerDesktopLinuxEngine';
async function engine(method,target,body){return await new Promise((resolve,reject)=>{const encoded=body===undefined?undefined:JSON.stringify(body);const request=http.request({socketPath,path:target,method,headers:encoded?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(encoded)}:{}},response=>{const chunks=[];response.on('data',b=>chunks.push(b));response.on('end',()=>{if(response.statusCode<200||response.statusCode>=300){reject(new Error('Local Docker API operation rejected: HTTP '+response.statusCode));return;}const text=Buffer.concat(chunks).toString();resolve(text?JSON.parse(text):null)});});request.on('error',()=>reject(new Error('Local Docker API transport failed')));request.setTimeout(30000,()=>request.destroy());request.end(encoded);});}
const networks=Object.keys(auth.NetworkSettings.Networks);assert.equal(networks.length,1);assert.equal(auth.Mounts.length,0);assert.equal(auth.HostConfig.AutoRemove,false);
const backup='supabase_auth_roomza_services_backup_'+randomUUID().slice(0,8);let renamed=false,disconnected=false,newId,enabled=false,migrationApplied=false;
const endpoint={Aliases:(auth.NetworkSettings.Networks[networks[0]].Aliases??[]).filter(a=>a!==auth.Id&&a!==auth.Id.slice(0,12))};
try{
 assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20261003081807'"),'0');assert.ok(!migration.includes('$services_migration$'));
 sql('begin;'+migration+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20261003081807','pinpoint_local_services',array[$services_migration$"+migration+'$services_migration$]);commit;notify pgrst,\'reload schema\';');migrationApplied=true;
 const env=auth.Config.Env.map(v=>/^GOTRUE_MFA_TOTP_(ENROLL|VERIFY)_ENABLED=/.test(v)?v.split('=')[0]+'=true':v);assert.equal(env.filter(v=>/^GOTRUE_MFA_TOTP_.*=true$/.test(v)).length,2);
 await engine('POST','/containers/'+auth.Id+'/stop?t=10');await engine('POST','/containers/'+auth.Id+'/rename?name='+backup);renamed=true;
 await engine('POST','/networks/'+networks[0]+'/disconnect',{Container:auth.Id,Force:false});disconnected=true;
 const created=await engine('POST','/containers/create?name=supabase_auth_roomza',{...auth.Config,Env:env,HostConfig:auth.HostConfig,NetworkingConfig:{EndpointsConfig:{[networks[0]]:endpoint}}});newId=created.Id;await engine('POST','/containers/'+newId+'/start');
 let healthy=false;for(let i=0;i<60;i++){const current=await engine('GET','/containers/'+newId+'/json');if(current.State.Health?.Status==='healthy'){healthy=true;break;}if(!current.State.Running)break;await new Promise(r=>setTimeout(r,500));}assert.ok(healthy,'Replacement Auth did not become healthy');
 const response=await fetch('http://127.0.0.1:54321/auth/v1/health',{headers:{apikey:local.NEXT_PUBLIC_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
 const active=inspect('supabase_auth_roomza');assert.deepEqual(active.Config.Env,env);assert.equal(active.Config.Image,auth.Config.Image);
 assert.deepEqual(counts(),before.counts);assert.deepEqual(protectedHashes(),before.protectedHashes);assert.equal(jobs(),before.jobs);for(const[n,id]of Object.entries(originalIds))assert.equal(inspect(n).Id,id);
 assert.equal(readFileSync(configPath,'utf8'),configBefore);writeFileSync(configPath,configBefore+'\n[auth.mfa.totp]\nenroll_enabled = true\nverify_enabled = true\n');
 await engine('DELETE','/containers/'+auth.Id);enabled=true;
 writeFileSync('docs/pinpoint-services-shared-local-evidence.json',JSON.stringify({recordedAt:new Date().toISOString(),environment:'Existing shared local stack; schema/config enablement and read-only smoke checks',migrationPath,migrationSha256:hash(migration),migrationApplied,authImage:auth.Config.Image,authPreviousId:auth.Id,authCurrentId:newId,totpEnabled:true,healthStatus:response.status,existingCountsBefore:before.counts,existingCountsAfter:counts(),propertyHashesBefore:before.protectedHashes,propertyHashesAfter:protectedHashes(),schedulesUnchanged:true,otherContainerIdsUnchanged:true,otherContainerIds:originalIds,fixturesCreated:false,passed:true},null,2)+'\n');console.log('Services migration applied and local Auth TOTP enabled; existing data, schedules and other containers preserved');
}finally{
 if(!enabled){if(newId){try{await engine('POST','/containers/'+newId+'/stop?t=5')}catch{}try{await engine('DELETE','/containers/'+newId)}catch{}}
 if(renamed){await engine('POST','/containers/'+auth.Id+'/rename?name=supabase_auth_roomza');if(disconnected)await engine('POST','/networks/'+networks[0]+'/connect',{Container:auth.Id,EndpointConfig:endpoint});}await engine('POST','/containers/'+auth.Id+'/start').catch(()=>{});console.log('Original Auth restored; additive migration state: '+migrationApplied);}
}
assert.ok(enabled);
