import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/all-work-deploy-20261013',r=JSON.parse(fs.readFileSync(dir+'/release.json'));
const read=f=>JSON.parse(fs.readFileSync(dir+'/'+f,'utf8').replace(/^\uFEFF/,''));
const before=read('worker-before.json'),after=read('worker-after.json'),worker=read('notification-worker-after.json');
assert.equal(after.id,r.result.version);assert.equal(worker.id,r.notificationWorker.version);
for(const b of before.resources.bindings){const a=after.resources.bindings.find(x=>x.name===b.name);assert(a);assert.equal(a.type,b.type);if(b.type==='plain_text')assert.equal(a.text,b.text);}
assert.deepEqual(after.resources.script_runtime,before.resources.script_runtime);
assert(after.resources.bindings.some(b=>b.name==='CRON_SECRET'&&b.type==='secret_text'));
assert(after.resources.bindings.some(b=>b.name==='NEXT_PUBLIC_VAPID_PUBLIC_KEY'&&b.type==='plain_text'));
assert(worker.resources.bindings.some(b=>b.name==='APP'&&b.type==='service'));
for(const name of ['SUPABASE_SERVICE_ROLE_KEY','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','CRON_SECRET'])assert(worker.resources.bindings.some(b=>b.name===name&&b.type==='secret_text'));
for(const deployment of [r.result,r.notificationWorker]){assert.equal(deployment.traffic.length,1);assert.equal(deployment.traffic[0].percentage,100);}
const result={verifiedAt:new Date().toISOString(),appVersion:after.id,notificationWorkerVersion:worker.id,traffic:100,previousBindingsPreserved:before.resources.bindings.length,appAddedBindings:['CRON_SECRET','NEXT_PUBLIC_VAPID_PUBLIC_KEY'],appRuntimeSettingsPreserved:true,notificationWorkerServiceBinding:true,notificationWorkerSecrets:4};
fs.writeFileSync(dir+'/production-settings.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
