import fs from 'node:fs';
const dir='docs/cloudflare-deploy-20261008/';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const prior=JSON.parse(fs.readFileSync('artifacts/signup-roles-20261008/release.json'));const pub=require('../../node_modules/dotenv').parse(fs.readFileSync(prior.build+'/.env.production.local'));
const origin=pub.NEXT_PUBLIC_APP_URL,checks=[];
for(const [route,key] of [['/?view=map','NEXT_PUBLIC_MAPTILER_API_KEY'],['/auth','NEXT_PUBLIC_TURNSTILE_SITE_KEY']]){
 const response=await fetch(origin+route,{signal:AbortSignal.timeout(20000)}),html=await response.text();let matched=html.includes(pub[key]);
 for(const m of html.matchAll(/src="([^" ]*\/_next\/static\/[^" ]+\.js)"/g)){if(matched)break;const u=new URL(m[1],origin),script=await fetch(u,{signal:AbortSignal.timeout(20000)});matched=(await script.text()).includes(pub[key]);}
 checks.push({route,key,matched});
}
fs.writeFileSync(dir+'public-input-check.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));if(checks.some(c=>!c.matched))process.exitCode=1;
