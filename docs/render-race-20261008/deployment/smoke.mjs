import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const release=JSON.parse(fs.readFileSync(path.join(dir,'release.json'))),origin='https://roomza.pinpoint-roomza.workers.dev';
const area='b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb';
const pages=['/?view=feed','/?view=map','/offers','/services','/auth','/auth/forgot-password','/auth/reset-password','/blog','/trust','/trust/safety','/trust/privacy'];
const cases=[...pages.map(p=>[p,'page']),...['/dashboard','/admin/reports','/profile','/messages','/post/entries'].map(p=>[p,'protected']),...['/api/listings?bbox=16,-35,19,-32&mode=rent','/api/listings?bbox=16,-35,19,-32&mode=buy','/api/offers?areaId='+area,'/api/offers/count?areaId='+area,'/api/entries?category=tourism&areaId='+area,'/api/entries?category=event&areaId='+area,'/api/services?areaId='+area].map(p=>[p,'api']),['/api/listings?mode=lease','invalid'],['/api/profile/documents/00000000-0000-4000-8000-000000000001/signed-url','private']];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),assetPaths=new Set(['/maplibre/6.11.2/maplibre-gl-worker.mjs','/maplibre/6.11.2/maplibre-gl-shared.mjs']);
async function batch(items,run){let next=0;const result=[];await Promise.all(Array.from({length:3},async()=>{while(next<items.length){const i=next++;result[i]=await run(items[i],i);}}));return result;}
const checks=await batch(cases,async([route,kind],i)=>{try{const start=Date.now(),response=await fetch(origin+route,{redirect:'manual',signal:AbortSignal.timeout(30000)}),body=await response.text(),status=response.status;
const marker=body.match(/<div[^>]*data-motion-route="stable"[^>]*>/)?.[0];
const redirect=(status>=300&&status<400&&/auth/.test(response.headers.get('location')??''))||(status===200&&body.includes('NEXT_REDIRECT')&&body.includes('/auth'));
let passed=kind==='page'?status===200&&!!marker&&!/opacity:\s*0(?:;|")/.test(marker):kind==='protected'?redirect:status===(kind==='invalid'?400:kind==='private'?401:200);
if(kind==='page'){fs.writeFileSync(path.join(dir,'page-'+String(i).padStart(2,'0')+'.html'),body);for(const m of body.matchAll(/src="([^" ]*\/_next\/static\/[^" ]+\.js)"/g))assetPaths.add(m[1].replaceAll('&amp;','&'));if(body.includes('"digest":"')&&!body.includes('NEXT_REDIRECT'))passed=false;}
return {route,kind,status,passed,ms:Date.now()-start,bytes:Buffer.byteLength(body),stableContainer:marker,serverAuthRedirect:kind==='protected'?redirect:undefined,bodySha256:hash(body),cfRay:response.headers.get('cf-ray')};}catch(e){return {route,kind,passed:false,error:e.message};}});
const assets=await batch([...assetPaths],async p=>{try{const url=new URL(p,origin);if(url.origin!==origin)throw Error('Unexpected origin');const response=await fetch(url,{signal:AbortSignal.timeout(30000)}),bytes=Buffer.from(await response.arrayBuffer()),local=fs.readFileSync(path.join(release.snapshot,'.open-next/assets',decodeURIComponent(url.pathname)));
return {path:p,status:response.status,sha256:hash(bytes),localSha256:hash(local),passed:response.status===200&&hash(bytes)===hash(local)};}catch(e){return {path:p,passed:false,error:e.message};}});
const result={at:new Date().toISOString(),origin,checks,assets,passed:checks.every(c=>c.passed)&&assets.every(c=>c.passed),scope:'Read-only unauthenticated HTTP, three concurrent requests, 30-second request deadlines; no browser, fixtures, writes or field Web Vitals measurement'};
fs.writeFileSync(path.join(dir,'smoke.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,routes:checks.length,assets:assets.length,failures:[...checks,...assets].filter(c=>!c.passed)},null,2));process.exitCode=result.passed?0:1;
