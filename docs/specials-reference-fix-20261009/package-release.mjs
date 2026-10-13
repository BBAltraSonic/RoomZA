import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
const dir='docs/specials-reference-fix-20261009',r=JSON.parse(fs.readFileSync(dir+'/release.json'));
const hash=x=>createHash('sha256').update(x).digest('hex'),zip=new JSZip(),entries=[];
for(const file of r.changedFiles){const bytes=fs.readFileSync(path.join(r.snapshot,file));if(hash(bytes)!==r.sourceHashes[file])throw Error('Snapshot drift: '+file);zip.file(file,bytes);entries.push({path:file,sha256:hash(bytes),bytes:bytes.length});}
for(const name of ['README.md','release.json','smoke.json','production-settings.json','preservation.json','browser.json','browser-audit.json','browser-authorization.json','browser-script-path.txt','banner-fixture.png','build.mjs','rebuild.mjs','minify-server.mjs','deploy-authorized.mjs','smoke.mjs','finalize.mjs','package-release.mjs','tests.log','typecheck.log','lint.log','build.log','size.log','deploy.log'])zip.file('release-evidence/'+name,fs.readFileSync(dir+'/'+name));
for(const file of fs.readdirSync(dir+'/browser'))zip.file('release-evidence/browser/'+file,fs.readFileSync(dir+'/browser/'+file));
const manifest={kind:'scoped-deployed-source',at:new Date().toISOString(),baselineVersion:r.previousVersion,workerVersion:r.result.version,databaseChanges:false,localBrowserValidScenarios:12,longTitleVisualVerificationPending:true,productionBrowserVerified:false,excludesUnrelatedDirtyWork:true,entries};
zip.file('manifest.json',JSON.stringify(manifest,null,2));
const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),file='artifacts/discovery-cards/specials-reference-fix-deployed-20261009.zip';
fs.writeFileSync(file,bytes);fs.writeFileSync(file+'.manifest.json',JSON.stringify({...manifest,artifactSha256:hash(bytes)},null,2));
const checked=await JSZip.loadAsync(bytes);for(const e of entries)if(hash(await checked.file(e.path).async('nodebuffer'))!==e.sha256)throw Error('Artifact mismatch: '+e.path);
console.log(JSON.stringify({file,sourceFiles:entries.length,bytes:bytes.length,sha256:hash(bytes)}));
