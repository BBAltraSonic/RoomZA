import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
const dir='docs/unified-marketplace-release-20261012',r=JSON.parse(fs.readFileSync(dir+'/release.json'));
const env=parseEnv(fs.readFileSync(path.join(r.snapshot,'.env.production.local'),'utf8'));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://qleeedwnnfvmfjjymoco.supabase.co');
const checks=[];
for(const [name,body]of [['ensure_marketplace_account',{}],['pinpoint_property_create_draft',{actor_id:'00000000-0000-4000-8000-000000000001',actor_session_id:'00000000-0000-4000-8000-000000000001',target:'00000000-0000-4000-8000-000000000001',payload:{}}]]){
 const response=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 checks.push({function:name,status:response.status,code:result.code,passed:[401,403].includes(response.status)&&result.code==='42501'});
}
const passed=checks.every(c=>c.passed);fs.writeFileSync(dir+'/rpc-api-denials.json',JSON.stringify({passed,checks,scope:'Anonymous calls only; ACL rejects before function bodies execute; no user accounts, sessions or drafts created.'},null,2));
console.log(JSON.stringify({passed,checks}));if(!passed)process.exitCode=1;
