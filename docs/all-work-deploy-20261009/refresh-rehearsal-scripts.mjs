import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const record='docs/all-work-deploy-20261009/release.json',r=JSON.parse(fs.readFileSync(record));
if(r.checks.length)throw Error('Cannot update a validated snapshot');
for(const file of ['scripts/db/verify-guest-contacts.mjs','scripts/db/verify-special-details.mjs']){
 const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(r.snapshot,file),bytes);r.sourceHashes[file]=createHash('sha256').update(bytes).digest('hex');
}
fs.writeFileSync(record,JSON.stringify(r,null,2));
