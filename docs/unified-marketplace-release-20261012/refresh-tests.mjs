import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const dir='docs/unified-marketplace-release-20261012',record=dir+'/release.json';
const release=JSON.parse(fs.readFileSync(record)),scope=JSON.parse(fs.readFileSync(dir+'/scope.json'));
const files=['src/app/services/services-discovery.test.tsx','src/features/admin/components/admin-nav.test.tsx'];
for(const file of files){const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(release.snapshot,file),bytes);release.sourceHashes[file]=createHash('sha256').update(bytes).digest('hex');if(!release.scopeFiles.includes(file))release.scopeFiles.push(file);if(!scope.files.includes(file))scope.files.push(file);}
release.testExpectationUpdates={files,reason:'Create listing replaces Add service, and is the first shared account menu destination; existing admin console and owner-only sections remain verified.'};
fs.writeFileSync(record,JSON.stringify(release,null,2));fs.writeFileSync(dir+'/scope.json',JSON.stringify(scope,null,2));
console.log(JSON.stringify({updated:files}));
