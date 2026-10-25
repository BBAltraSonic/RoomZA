import fs from 'node:fs';
import {createHash} from 'node:crypto';
const endpoint='https://qleeedwnnfvmfjjymoco.supabase.co/functions/v1/import-image';
// Reuse the protected existing production credential; never retain or print it.
const key=JSON.parse(fs.readFileSync('.cache/release-project-keys-20261025.json')).find(x=>x.name==='service_role').api_key;
const answer=await fetch('https://cloudflare-dns.com/dns-query?name=www.gstatic.com&type=A',{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(15000)}).then(r=>r.json());
const addresses=answer.Answer.filter(x=>x.type===1).map(x=>x.data);
const results=[];
for(const [name,body,status]of [['exact public PNG',{url:'https://www.gstatic.com/webp/gallery3/1.png',addresses},200],['private literal denied',{url:'https://127.0.0.1/a.png',addresses:['127.0.0.1']},502],['certificate identity mismatch denied',{url:'https://mismatch.pinpoint.invalid/a.png',addresses},502]]){
 const r=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const bytes=Buffer.from(await r.arrayBuffer()),sha256=createHash('sha256').update(bytes).digest('hex');
 results.push({name,status:r.status,passed:r.status===status&&(status!==200||sha256==='776130f3e1d2810c45e3bccc1c11fa6fbe14155e0c298dc61b0bea16cbbc1ad2'),bytes:bytes.length,sha256});
}
const no=await fetch(endpoint,{method:'POST',body:'{}',signal:AbortSignal.timeout(15000)});results.push({name:'unauthenticated denied',status:no.status,passed:no.status===401});
const report={checkedAt:new Date().toISOString(),version:3,passed:results.every(x=>x.passed),results};
fs.writeFileSync('docs/all-work-deploy-20261025/import-image-verified.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
