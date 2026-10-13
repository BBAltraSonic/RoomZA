import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='.cache/all-work-release-20261009/';
const unwrap=file=>JSON.parse(JSON.parse(JSON.parse(fs.readFileSync(base+file)).content[0].text).result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/)[1])[0].evidence;
const before=unwrap('database-before.json'),after=unwrap('database-after.json');
assert.deepEqual(after.counts,before.counts);assert.deepEqual(after.fingerprints,before.fingerprints);
assert(after.latest_migrations.some(m=>m.version==='20261009103541'&&m.name==='guest_public_contacts'));
for(const name of ['pinpoint_intake_validate','pinpoint_entry_content','pinpoint_service_content']){
 const f=after.functions.find(f=>f.name.includes('.'+name+'('));assert(f.definition.includes('private.pinpoint_contact_validate('));assert(f.definition.includes('private.discovery_card_validate('));if(name!=='pinpoint_service_content')assert(f.definition.includes('private.special_links_validate('));
 assert.deepEqual(f.acl,before.functions.find(x=>x.name===f.name).acl);
}
assert(fs.readFileSync(base+'migration-after.log','utf8').includes('Remote database is up to date'));
const record='docs/all-work-deploy-20261009/release.json',r=JSON.parse(fs.readFileSync(record));
assert(r.readyAt);
r.packagingMinification=JSON.parse(fs.readFileSync('docs/all-work-deploy-20261009/minification.log','utf8').trim());
r.additionalTests={files:3,tests:9,passed:true,log:'places-tests.log'};
r.databaseAppliedAt=new Date().toISOString();r.databaseMigration={version:'20261009103541',name:'guest_public_contacts',sha256:createHash('sha256').update(fs.readFileSync('supabase/migrations/20261009103541_guest_public_contacts.sql')).digest('hex'),alreadyApplied:['20261008165344','20261009124326','20261009151629'],countsPreserved:true,contentFingerprintsPreserved:true,validatorExtensionsAndGrantsPreserved:true,evidence:base};
fs.writeFileSync(record,JSON.stringify(r,null,2));console.log('Verified database recorded; all repository migrations are applied.');
