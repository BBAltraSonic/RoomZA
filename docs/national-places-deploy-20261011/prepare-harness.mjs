import fs from 'node:fs';
const dir='docs/national-places-deploy-20261011';
const manifest=JSON.parse(fs.readFileSync('artifacts/national-places/national-places-20261011.zip.manifest.json'));
let script=fs.readFileSync('docs/service-details-deploy-20261011/release.mjs','utf8');
script=script.replace(/const scope=\[[\s\S]*?\];/, 'const scope='+JSON.stringify(manifest.entries.map(e=>e.path))+';');
script=script.replace(/const tests=\[[\s\S]*?\];/, 'const tests='+JSON.stringify([
 'src/features/places/catalogue.test.ts','src/features/places/server.test.ts',
 'src/features/map-discovery/location-selector.test.tsx',
 'src/app/api/discovery/places/route.test.ts','src/app/api/private/offers/places/route.test.ts',
 'src/features/map-discovery/discovery-page.filters-url.test.tsx',
 'src/features/map-discovery/discovery-page.consistency.test.tsx',
 'src/features/map-discovery/search-suggestions.test.ts',
 'src/features/map-discovery/discovery-page.request-manager.test.tsx',
 'src/features/map-discovery/discovery-page.detail-loader.test.tsx',
 'src/features/map-discovery/discovery-page.sheet-persistence.test.tsx',
])+';');
script=script.replace("import {tmpdir} from 'node:os';\n",'');
script=script.replace("path.join(tmpdir(),'pinpoint-service-details-release-'+randomUUID())","path.join(root,'.cache','pinpoint-national-places-release-'+randomUUID())");
script=script.replace("scope:'Service card details, approved-only detail API, query navigation and focused tests'","scope:'Nationwide South African place catalogue, shared autocomplete and focused tests'");
script=script.replace('databaseChanges:false','databaseChanges:true');
script=script.replace("for(const file of scope){",`const manifest=readJson(path.join(root,'artifacts/national-places/national-places-20261011.zip.manifest.json'));
 for(const entry of manifest.entries){
  if(entry.kind==='delta'&&release.sourceHashes[entry.path]!==entry.baselineSha256)throw Error('Production baseline mismatch: '+entry.path);
  if(hash(fs.readFileSync(path.join(root,entry.path)))!==entry.sha256)throw Error('Package source mismatch: '+entry.path);
 }
 for(const file of scope){`);
script=script.replace("All baseline source hashes preserved except the 15 reviewed service-details files. Concurrent Specials galleries, catalogue migrations and other dirty work excluded.","Baseline source preserved except 17 catalogue delta files and 19 new scoped files. Unrelated Auth, Services, galleries and dirty work excluded.");
script=script.replace("...scope]);","...scope.filter(file=>/\\.(tsx?|mjs)$/.test(file))]);");
script=script.replace('--message=service-details-20261011','--message=national-places-20261011');
script=script.replace("JSON.stringify(after,null,2)","JSON.stringify(after.map(({author_email,...item})=>item),null,2)");
fs.writeFileSync(dir+'/release.mjs',script);
fs.copyFileSync('docs/all-work-deploy-20261009/minify-server.mjs',dir+'/minify-server.mjs');
fs.copyFileSync('docs/service-details-deploy-20261011/verify-settings.mjs',dir+'/verify-settings.mjs');
let verify=fs.readFileSync(dir+'/verify-settings.mjs','utf8').replaceAll('docs/service-details-deploy-20261011',dir);
fs.writeFileSync(dir+'/verify-settings.mjs',verify);
console.log('Prepared bounded release harness: '+manifest.entries.length+' source files');
