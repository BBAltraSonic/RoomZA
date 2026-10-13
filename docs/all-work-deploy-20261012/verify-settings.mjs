import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/all-work-deploy-20261012',r=JSON.parse(fs.readFileSync(dir+'/release.json'));
assert(r.deployed);assert.equal(r.result.traffic.length,1);assert.equal(r.result.traffic[0].percentage,100);
const before=JSON.parse(fs.readFileSync(dir+'/worker-before.json','utf8').replace(/^\uFEFF/,''));
// The calling task captured this version through the authenticated Cloudflare API.
const after=JSON.parse(fs.readFileSync(dir+'/worker-after.json'));
assert.equal(after.id,r.result.version);
const bindings=value=>value.resources.bindings.map(b=>({name:b.name,type:b.type})).sort((a,b)=>a.name.localeCompare(b.name));
assert.deepEqual(bindings(after),bindings(before));
assert.deepEqual(after.resources.script_runtime.compatibility_flags,before.resources.script_runtime.compatibility_flags);
assert.equal(after.resources.script_runtime.compatibility_date,before.resources.script_runtime.compatibility_date);
assert.deepEqual(after.resources.script_runtime.assets,before.resources.script_runtime.assets);
for(const b of before.resources.bindings.filter(b=>b.type==='plain_text'))assert.equal(after.resources.bindings.find(x=>x.name===b.name).text,b.text);
const result={verifiedAt:new Date().toISOString(),deployment:r.result.deployment,version:after.id,traffic:r.result.traffic,previousVersion:before.id,bindingsPreserved:true,publicVariablesPreserved:true,settings:{compatibility_date:after.resources.script_runtime.compatibility_date,compatibility_flags:after.resources.script_runtime.compatibility_flags,bindings:bindings(after)}};
fs.writeFileSync(dir+'/production-settings.json',JSON.stringify(result,null,2));console.log(JSON.stringify({version:result.version,traffic:100,bindings:result.settings.bindings.length,preserved:true}));
