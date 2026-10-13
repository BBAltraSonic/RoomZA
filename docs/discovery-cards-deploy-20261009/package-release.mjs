import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
const dir='docs/discovery-cards-deploy-20261009',r=JSON.parse(fs.readFileSync(dir+'/release.json'));
const hash=x=>createHash('sha256').update(x).digest('hex'),zip=new JSZip(),entries=[];
const paths=[...new Set(r.changes.map(c=>c.path))];
for(const source of paths){let file=source,bytes=fs.readFileSync(path.join(r.snapshot,source));if(hash(bytes)!==r.sourceHashes[source])throw Error('Snapshot drift: '+source);
 if(source==='supabase/migrations/20261009105638_discovery_cards_media_saves.sql')file=r.workspaceMigration;
 if(source==='scripts/db/verify-discovery-card-migration.mjs')bytes=Buffer.from(bytes.toString().replaceAll('20261009105638_discovery_cards_media_saves.sql','20261009124326_discovery_cards_media_saves.sql'));
 if(source==='docs/discovery-cards-20261009.md')bytes=fs.readFileSync(source);
 zip.file(file,bytes);entries.push({path:file,sourcePath:source,sha256:hash(bytes),bytes:bytes.length});}
for(const name of ['README.md','release.json','smoke.json','production-settings.json','security-before.json','security-after.json','prepare.mjs','minify-server.mjs','deploy-authorized.mjs','smoke.mjs','tests.log','typecheck.log','lint.log','audit.log','build.log','size.log','deploy.log'])zip.file('release-evidence/'+name,fs.readFileSync(dir+'/'+name));
zip.file('release-evidence/sql-legacy.log',fs.readFileSync('.cache/discovery-cards-db-legacy.log'));zip.file('release-evidence/sql-contact-aware.log',fs.readFileSync('.cache/discovery-cards-db-deploy.log'));
const manifest={kind:'scoped-deployed-source',at:new Date().toISOString(),baseline:r.baseManifest,workerVersion:r.result.version,databaseVersion:r.databaseVersion,browserVerified:false,excludesGuestMutationAndPropertyMobileWork:true,entries};zip.file('release-evidence/release.json',JSON.stringify({...r,artifact:undefined},null,2));zip.file('manifest.json',JSON.stringify(manifest,null,2));const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});const file='artifacts/discovery-cards/specials-services-deployed-20261009.zip';fs.writeFileSync(file,bytes);fs.writeFileSync(file+'.manifest.json',JSON.stringify({...manifest,artifactSha256:hash(bytes)},null,2));const checked=await JSZip.loadAsync(bytes);for(const e of entries)if(hash(await checked.file(e.path).async('nodebuffer'))!==e.sha256)throw Error('Artifact mismatch: '+e.path);console.log(JSON.stringify({file,sourceFiles:entries.length,bytes:bytes.length,sha256:hash(bytes)}));
