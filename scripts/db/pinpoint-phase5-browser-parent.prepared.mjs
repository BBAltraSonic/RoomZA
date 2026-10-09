import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,symlinkSync,openSync,closeSync,rmSync,lstatSync,realpathSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
export async function run(cfg,accounts,password,saleId,sql,appFetch){
 assert.equal(process.env.PINPOINT_APPROVED_BROWSER_ATTEMPT,'11','Explicit BB approval required; prepared only');assert.equal(cfg.browserAttempt,11);assert.match(cfg.dbName,/^pinpoint-release-[0-9a-f-]{36}-db$/);assert.equal(cfg.supabaseUrl,'http://127.0.0.1:55431');
 const attemptId=randomUUID(),tag='pinpoint-phase5-app-'+attemptId,appRoot=path.join(tmpdir(),tag),origin='http://localhost:3116',driver=path.join(tmpdir(),'playwright-test-pinpoint-phase5-'+attemptId+'.js'),result=path.join(cfg.sourceRoot,'docs','pinpoint-phase5-attempt11-'+attemptId+'.json'),guard=path.join(tmpdir(),tag+'-guard.cjs'),log=path.join(cfg.sourceRoot,'docs','pinpoint-phase5-attempt11-'+attemptId+'-app.log');
 let app,fd; const sourceHashes={};
 const helpers=createRequire(path.join(cfg.sourceRoot,'package.json'))('./scripts/db/pinpoint-phase5-browser-checks.prepared.cjs');
 const analyticsBefore=helpers.captureAnalytics(sql,cfg.dbName);
 mkdirSync(appRoot);
 const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:cfg.sourceRoot,encoding:'utf8'}).trim().split(/\r?\n/))];
 for(const file of files){if(!file||/^(?:\.env|\.git|\.agents|\.codex|docs\/|scripts\/|supabase\/|\.next)/.test(file))continue;const src=path.join(cfg.sourceRoot,file),dst=path.join(appRoot,file);assert.ok(path.resolve(dst).startsWith(appRoot+path.sep));mkdirSync(path.dirname(dst),{recursive:true});copyFileSync(src,dst);sourceHashes[file]=createHash('sha256').update(readFileSync(src)).digest('hex');}
 symlinkSync(path.join(cfg.sourceRoot,'node_modules'),path.join(appRoot,'node_modules'),'junction');
 writeFileSync(guard,`const real=globalThis.fetch;const allowed=${JSON.stringify([origin,cfg.supabaseUrl])};globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!allowed.includes(u.origin))throw new Error('Blocked outside Phase 4 clone');return real(input,init)};`);
 const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:cfg.supabaseUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:cfg.anonKey,SUPABASE_SERVICE_ROLE_KEY:cfg.serviceKey,NEXT_PUBLIC_APP_URL:origin,NEXT_TELEMETRY_DISABLED:'1',LOG_LEVEL:'warn',PINPOINT_LOCAL_VERIFY_DIST_DIR:'.next-pinpoint-verify-'+attemptId,NODE_OPTIONS:'--require '+guard};
 for(const key of ['RESEND_API_KEY','QSTASH_TOKEN','QSTASH_CURRENT_SIGNING_KEY','QSTASH_NEXT_SIGNING_KEY','CRON_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','VAPID_PRIVATE_KEY','NEXT_PUBLIC_VAPID_PUBLIC_KEY','NEXT_PUBLIC_SENTRY_DSN','SENTRY_DSN','NEXT_PUBLIC_TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','NEXT_PUBLIC_MAPTILER_API_KEY','LIVEKIT_API_KEY','LIVEKIT_API_SECRET','LIVEKIT_URL','NEXT_PUBLIC_LIVEKIT_URL'])env[key]='';
 sql(`update public.listings set latitude=-33.9249,longitude=18.4241,property_type='apartment',bedrooms=2,bathrooms=1,parking_type='none',parking_count=0,electricity_type='prepaid',water_availability='municipal',lease_duration='12_months',availability_date='2026-11-01' where id='${saleId}';`);
 for(const a of accounts)sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${a.id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing;`);
 const privateIds={document:randomUUID(),version:randomUUID(),share:randomUUID(),notification:randomUUID()};
 const privatePath=accounts[4].id+'/'+privateIds.document+'/'+privateIds.version+'.pdf',privateBytes='%PDF-1.4\nAttempt 10 private fixture\n%%EOF';
 const {createClient}=createRequire(path.join(cfg.sourceRoot,'package.json'))('@supabase/supabase-js');
 const storageAdmin=createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await storageAdmin.storage.from('profile-documents').upload(privatePath,privateBytes,{contentType:'application/pdf'})).error,null);
 sql(`insert into public.profile_documents(id,owner_id,document_type,display_name) values('${privateIds.document}','${accounts[4].id}','other','Attempt 10 private fixture'); insert into public.profile_document_versions(id,document_id,owner_id,version,bucket,path,mime_type,size_bytes,checksum_sha256) values('${privateIds.version}','${privateIds.document}','${accounts[4].id}',1,'profile-documents','${privatePath}','application/pdf',${Buffer.byteLength(privateBytes)},'${createHash('sha256').update(privateBytes).digest('hex')}'); insert into public.notification_events(id,recipient_id,type,payload) values('${privateIds.notification}','${accounts[4].id}','new_message','{"message":"Attempt 10 private notification"}'::jsonb);`);
 const orgId=sql(`select id from public.organizations where owner_id='${accounts[0].id}' and slug=(select title from public.listings where id='${saleId}')`);
 assert.match(orgId,/^[0-9a-f-]{36}$/);
 const managedId=sql(`select id from public.listings where organization_id='${orgId}' and landlord_id='${accounts[0].id}' limit 1`);assert.match(managedId,/^[0-9a-f-]{36}$/);
 sql(`update public.organization_memberships set revoked_at=null where organization_id='${orgId}' and user_id in ('${accounts[0].id}','${accounts[1].id}') and role in ('owner','admin');`);
 copyFileSync(path.join(cfg.sourceRoot,'scripts/db/pinpoint-phase5-browser-driver.prepared.cjs'),driver);
 const browserCfg={sourceRoot:cfg.sourceRoot,privateIds,privateBytes,managedId,orgId,attemptNumber:11,attemptId,appOrigin:origin,dbOrigin:cfg.supabaseUrl,dbName:cfg.dbName,dbPassword:cfg.dbPassword,accounts,password,saleId,title:sql(`select title from public.listings where id='${saleId}'`),resultPath:result};
 writeFileSync(result,JSON.stringify({attemptNumber:11,attemptId,status:'prepared; browser not launched',sourceHashes,driverSha256:createHash('sha256').update(readFileSync(driver)).digest('hex')},null,2)+'\n');
 try{
 fd=openSync(log,'w');app=spawn(process.execPath,[path.join(cfg.sourceRoot,'node_modules/next/dist/bin/next'),'dev','--webpack','--port','3116'],{cwd:appRoot,env,stdio:['ignore',fd,fd],windowsHide:true});
 let ready=false;for(let i=0;i<30;i++){assert.equal(app.exitCode,null,'Snapshot server exited');try{ready=(await appFetch(origin+'/auth',{signal:AbortSignal.timeout(15000)})).status===200;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'Snapshot readiness did not pass; browser not launched');
 const child=spawn(process.execPath,['C:/Users/BB/.agents/skills/playwright/run.js',driver],{cwd:appRoot,env:{...env,PINPOINT_BROWSER_CONFIG:JSON.stringify(browserCfg)},stdio:'inherit',windowsHide:true});
 const status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});const evidence=JSON.parse(readFileSync(result));evidence.sourceHashes=sourceHashes;evidence.driverSha256=createHash('sha256').update(readFileSync(driver)).digest('hex');writeFileSync(result,JSON.stringify(evidence,null,2)+'\n');assert.equal(status,0,'Browser attempt 11 failed; no automatic retry');return evidence;
 }finally{
 await storageAdmin.storage.from('profile-documents').remove([privatePath]);
 sql(`delete from public.notification_events where id='${privateIds.notification}' and recipient_id='${accounts[4].id}'; delete from public.profile_document_versions where id='${privateIds.version}' and owner_id='${accounts[4].id}'; delete from public.profile_documents where id='${privateIds.document}' and owner_id='${accounts[4].id}'; `);
 for(const a of accounts)sql(`delete from public.auth_login_attempts where email_hash='${createHash('sha256').update(a.email.trim().toLowerCase()).digest('hex')}'`);
 const fixtureTitle=sql(`select title from public.listings where id='${saleId}'`);
 assert.match(fixtureTitle,/^phase4-[0-9a-f-]{36}$/);
 sql(`delete from public.listings where landlord_id='${accounts[0].id}' and title='${fixtureTitle} (Copy)'`);
 if(app&&app.exitCode===null){assert.ok(Number.isInteger(app.pid)&&app.pid>0);try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F'],{stdio:'ignore'});}catch{app.kill();}}if(fd!==undefined)closeSync(fd);
 assert.ok(path.resolve(appRoot).startsWith(path.resolve(tmpdir())+path.sep));assert.equal(path.basename(appRoot),tag);
 const analyticsIds=helpers.cleanCapturedAnalytics(sql,cfg.dbName,analyticsBefore);
 const dep=path.join(appRoot,'node_modules');assert.ok(lstatSync(dep).isSymbolicLink());assert.equal(realpathSync(dep).toLowerCase(),realpathSync(path.join(cfg.sourceRoot,'node_modules')).toLowerCase());rmdirSync(dep);
 rmSync(appRoot,{recursive:true,force:true});
 console.info('Captured browser analytics cleaned',analyticsIds);
 }
}
