import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),r=JSON.parse(fs.readFileSync(path.join(dir,'release.json')));
const env=Object.fromEntries(fs.readFileSync(path.join(r.snapshot,'.env.production.local'),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const response=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY}}),settings=await response.json();
assert.equal(response.status,200);assert.equal(settings.mailer_autoconfirm,true);assert.equal(settings.disable_signup,false);
const checks=[];
for(const [route,expected]of [['/auth/verify-email?redirect=%2Fsaved','/auth?redirect=%2Fsaved'],['/auth/verify-email?redirect=https%3A%2F%2Fevil.example','/auth?redirect=%2F'],['/auth/verify-email?redirect=%2Fauth%2Fverify-email','/auth?redirect=%2F']]){
 const resp=await fetch(r.origin+route,{redirect:'manual'});const body=await resp.text(),location=resp.headers.get('location');
 const direct=location?new URL(location,r.origin).pathname+new URL(location,r.origin).search:null;
 const redirected=(resp.status>=300&&resp.status<400&&direct===expected)||(resp.status===200&&body.includes('NEXT_REDIRECT')&&body.includes(expected));
 assert(redirected,route+' unexpected redirect '+direct);
 assert(!body.includes('Confirm your email address to continue.'));checks.push({route,status:resp.status,destination:expected,passed:true});
}
const resp=await fetch(r.origin+'/auth'),body=await resp.text();assert.equal(resp.status,200);assert(body.includes('Continue to Pinpoint'));assert(!body.includes('Email verified.'));
const handler=fs.readFileSync(path.join(r.snapshot,'.open-next/server-functions/default/handler.mjs'),'utf8');
for(const phrase of ['Check your inbox for a verification link.','The existing account must verify its email before promotion.','Confirm your email address to continue.','Your verification link is invalid or expired.','Verified Email'])assert(!handler.includes(phrase),'Retired prompt in build: '+phrase);
const before=JSON.parse(fs.readFileSync(path.join(dir,'worker-before.json'))),after=JSON.parse(fs.readFileSync(path.join(dir,'worker-after.json')));
const bindings=v=>v.resources.bindings.map(b=>({name:b.name,type:b.type})).sort((a,b)=>a.name.localeCompare(b.name));
assert.deepEqual(bindings(after),bindings(before));
assert.deepEqual(after.resources.script_runtime,before.resources.script_runtime);
for(const b of before.resources.bindings.filter(b=>b.type==='plain_text'))assert.equal(after.resources.bindings.find(x=>x.name===b.name).text,b.text);
const result={passed:true,checks,hostedSignupAutoconfirm:true,retiredPromptsAbsent:true,bindingsAndVariablesPreserved:true,browserSignupTested:false,version:r.result.version};
fs.writeFileSync(path.join(dir,'auth-verified.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
