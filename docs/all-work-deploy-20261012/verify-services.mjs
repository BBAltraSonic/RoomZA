import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const release=JSON.parse(fs.readFileSync(path.join(dir,'release.json')));
const checks=[];
for(const id of ['9591f11f-4512-48bb-9f74-260c90ceae7a','ab133fea-bfeb-4d84-877b-e5b3d6c2a527']) {
  const response=await fetch(release.origin+'/api/services/'+id,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/(?:^|,\s*)no-store(?:,|$)/);
  const value=await response.json();assert.equal(value.item.id,id);assert(value.item.content.title);
  assert(!('draft' in value.item));assert(!('submitted' in value.item));
  checks.push({id,status:response.status,approvedDetail:true,privateDraftExcluded:true,noStore:true});
}
for(const [id,status]of [['invalid',400],['00000000-0000-4000-8000-000000000001',404]]) {
  const response=await fetch(release.origin+'/api/services/'+id,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/(?:^|,\s*)no-store(?:,|$)/);
  checks.push({id,status:response.status,noStore:true});
}
const result={at:new Date().toISOString(),origin:release.origin,checks,passed:true,scope:'Read-only public Service detail API; no browser or database writes'};
fs.writeFileSync(path.join(dir,'services.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
