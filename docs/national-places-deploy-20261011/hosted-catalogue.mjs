import fs from 'node:fs';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';
const dir='docs/national-places-deploy-20261011';
const production=parseEnv(fs.readFileSync('.env.production.local','utf8'));
const origin=process.argv.includes('--worker')?'https://roomza.pinpoint-roomza.workers.dev':production.NEXT_PUBLIC_SUPABASE_URL;
const headers=process.argv.includes('--worker')?{}:{apikey:production.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+production.NEXT_PUBLIC_SUPABASE_ANON_KEY};
const queries=JSON.parse(fs.readFileSync('.cache/national-places/sql-verification.json','utf8')).searches;
const result={target:origin,at:new Date().toISOString(),checks:[]};
let emptyAreaId;
for(const item of queries){
 const worker=process.argv.includes('--worker');
 const route=worker?'/api/discovery/places?q='+encodeURIComponent(item.query):'/rest/v1/rpc/search_discovery_places?search_query='+encodeURIComponent(item.query);
 const start=Date.now(),response=await fetch(origin+route,{headers,signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200,item.query+' request failed');const body=await response.json();
 const places=worker?body.data.places:body;
 if(worker&&item.query==='Kimberley')emptyAreaId=places.find(p=>p.label==='Kimberley')?.id;
 assert(places.length<=6&&places.length>0);
 const expected=item.results[0];assert(places.some(p=>(p.name??p.label)===expected.name&&(p.region??p.secondaryLabel)===expected.region),'Missing representative: '+item.query);
 for(const place of places){assert(/^[0-9a-f-]{36}$/i.test(place.id));const center=worker?place.center:{lat:place.center_lat,lng:place.center_lng};assert(center.lat>=-35&&center.lat<=-22&&center.lng>=16&&center.lng<=33);}
 result.checks.push({query:item.query,ms:Date.now()-start,results:places.map(p=>({id:p.id,name:p.name??p.label,region:p.region??p.secondaryLabel}))});
}
if(process.argv.includes('--worker')){
 for(const [route,status] of [['/api/discovery/places?q=x',400],['/api/discovery/places?q=zzzzzzqqqqq',200]]){
  const response=await fetch(origin+route,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,status);if(route.includes('zzzz'))assert.equal((await response.json()).data.places.length,0);result.checks.push({route,status});
 }
 const privateSearch=await fetch(origin+'/api/private/offers/places?q=Durban',{redirect:'manual',signal:AbortSignal.timeout(30000)});assert.equal(privateSearch.status,307);assert(privateSearch.headers.get('location')?.startsWith('/auth?redirect='));result.checks.push({privateChooserLoginRedirect:true,status:privateSearch.status});
 const old='b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb';
 const recent=await fetch(origin+'/api/discovery/places?recent='+old,{signal:AbortSignal.timeout(30000)});assert.equal(recent.status,200);assert.equal((await recent.json()).data.recentPlaces[0].id,old);result.checks.push({recentId:old,passed:true});
 assert(emptyAreaId);
 const lookup=await fetch(origin+'/api/places/'+emptyAreaId,{signal:AbortSignal.timeout(30000)});assert.equal(lookup.status,200);assert.equal((await lookup.json()).data.place.id,emptyAreaId);result.checks.push({reloadAreaId:emptyAreaId,passed:true});
 for(const mode of ['rent','buy']){
  const listings=await fetch(origin+'/api/listings?areaId='+emptyAreaId+'&mode='+mode,{signal:AbortSignal.timeout(30000)});assert.equal(listings.status,200);assert.equal((await listings.json()).data.listings.length,0);result.checks.push({emptyPublishedArea:emptyAreaId,mode,passed:true});
 }
}else{
 const deny=await fetch(origin+'/rest/v1/rpc/import_discovery_place_batch',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{"records":[]}',signal:AbortSignal.timeout(30000)});
 assert([401,403].includes(deny.status),'Anonymous importer execution must be denied');result.checks.push({anonymousImportDenied:true,status:deny.status});
}
result.passed=true;fs.writeFileSync(dir+(process.argv.includes('--worker')?'/catalogue-worker.json':'/catalogue-database.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,target:origin,checks:result.checks.length}));
