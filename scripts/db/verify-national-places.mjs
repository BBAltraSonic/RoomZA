// Actual PostgreSQL extension/RLS/import rehearsal. No hosted database writes.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '../../.cache/discovery-cards-sql/node_modules/@electric-sql/pglite/dist/index.js';
import { pg_trgm } from '../../.cache/discovery-cards-sql/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js';
import { unaccent } from '../../.cache/discovery-cards-sql/node_modules/@electric-sql/pglite/dist/contrib/unaccent.js';
import { fuzzystrmatch } from '../../.cache/discovery-cards-sql/node_modules/@electric-sql/pglite/dist/contrib/fuzzystrmatch.js';
import { applyManifest, parseGeoNames } from './national-places.mjs';
const db=new PGlite({extensions:{pg_trgm,unaccent,fuzzystrmatch}});
let checks=0;
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const fails=async(sql,args,code)=>{await assert.rejects(db.query(sql,args),e=>e.code===code);checks++;};
const migration='supabase/migrations/20261011114646_national_place_catalogue.sql';
try {
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(await readFile('supabase/migrations/20260927090000_pinpoint_places.sql','utf8'));
  const legacy='b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb';
  const legacyPath=process.argv.find(x=>x.startsWith('--legacy='))?.slice(9);
  if(legacyPath) {
    const legacyRows=JSON.parse(await readFile(legacyPath,'utf8'));
    for(const p of legacyRows)await db.query('insert into discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[p.id,p.provider_id,p.level,p.name,p.region,p.full_address,p.center_lat,p.center_lng,p.west,p.south,p.east,p.north,p.created_at]);
  } else await db.query("insert into discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north) values($1,'neighbourhood.rondebosch','neighbourhood','Rondebosch','Cape Town, South Africa','Rondebosch, Cape Town',-33.96,18.47,18.4,-34,18.6,-33.9)",[legacy]);
  const legacySnapshot=await rows('select to_jsonb(p) value from discovery_places p order by id');
  const before=await rows('select to_jsonb(p) value from discovery_places p where id=$1',[legacy]);
  await db.exec(await readFile(migration,'utf8'));
  equal(await rows('select to_jsonb(p) value from discovery_places p where id=$1',[legacy]),before);
  await db.query('update discovery_places set name=name where id=$1',[legacy]);
  equal(await rows('select to_jsonb(p) value from discovery_places p where id=$1',[legacy]),before);
  const make=(id,name,alt='')=>[id,name,name,alt,'-26.2678','27.8585','P','PPL','ZA','','06','JHB','','','1'].join('\t');
  const {records}=parseGeoNames([make('1','Soweto','Soweto Township'),make('2','Gqeberha','Port Elizabeth'),make('3','Rondebosch'),make('4','Sotho')].join('\n'),'ZA.06\tGauteng','ZA.06.JHB\tJohannesburg',{downloaded_at:'2026-10-11T00:00:00Z',sha256:'fixture'});
  records[2].target_id=legacy;
  const run=async records=>(await rows('select import_discovery_place_batch($1) value',[JSON.stringify(records)]))[0].value;
  await db.exec('set role service_role');
  equal(await applyManifest(records,run),{inserted:3,linked:1,batches:1});
  const ids=await rows('select id,provider_id from discovery_places order by id');
  equal(await applyManifest(records,run),{inserted:0,linked:4,batches:1});
  equal(await rows('select id,provider_id from discovery_places order by id'),ids);
  equal(await rows('select to_jsonb(p) value from discovery_places p where id=$1',[legacy]),before);
  await fails('select import_discovery_place_batch($1)',[JSON.stringify([{...records[0],target_id:legacy}])],'22023');
  await fails('select import_discovery_place_batch($1)',[JSON.stringify([{...records[0],province:null}])],'22023');
  await fails('select import_discovery_place_batch($1)',[JSON.stringify([{...records[0],west:30,east:29}])],'22023');
  await fails('select import_discovery_place_batch($1)',[JSON.stringify([{...records[0],sources:[{...records[0].sources[0],sha256:''}]}])],'22023');
  await db.exec('set role anon');
  for(const query of ['Soweto','Sowe','Sowteo','Soweto Gauteng','Soweto Johannesburg','Soweto Township']) equal((await rows('select name from search_discovery_places($1)',[query]))[0]?.name,'Soweto');
  equal((await rows('select name from search_discovery_places($1)',['Soweto'])).map(r=>r.name),['Soweto']);
  equal((await rows('select name from search_discovery_places($1)',['Sowteo'])).map(r=>r.name),['Soweto']);
  equal((await rows('select name from search_discovery_places($1)',['Port Elizabeth']))[0]?.name,'Gqeberha');
  equal((await rows('select name from search_discovery_places($1)',['Ronde']))[0]?.name,'Rondebosch');
  equal((await rows('select extent_kind from read_discovery_places(array[$1::uuid])',[ids.find(x=>x.provider_id==='geonames:1').id]))[0]?.extent_kind,'viewport');
  equal(await rows('select name from search_discovery_places($1)',['qzxwvv']),[]);
  equal(await rows('select name from search_discovery_places($1)',['--']),[]);
  await fails('select import_discovery_place_batch($1)',[JSON.stringify(records)],'42501');
  await fails("insert into discovery_place_metadata(place_id,province,extent_kind) values($1,'Gauteng','viewport')",[legacy],'42501');
  await fails("delete from discovery_places where id=$1",[legacy],'42501');
  await db.exec('set role authenticated');
  equal((await rows('select name from search_discovery_places($1)',['Sowe']))[0]?.name,'Soweto');
  await fails('select import_discovery_place_batch($1)',[JSON.stringify(records)],'42501');
  await fails('update discovery_place_sources set provenance=$1',[JSON.stringify({})],'42501');
  await db.exec('reset role');
  const manifestPath=process.argv.find(x=>x.startsWith('--manifest='))?.slice(11);
  const report={checks,fixture_checks_passed:true};
  if(manifestPath) {
    // Remove synthetic source fixtures before checking authentic data. Retain
    // only the unchanged legacy row used for preservation checks.
    await db.exec('delete from discovery_place_terms;delete from discovery_place_sources;delete from discovery_place_metadata;');
    await db.query('delete from discovery_places where not(id=any($1::uuid[]))',[legacySnapshot.map(r=>r.value.id)]);
    for(const r of legacySnapshot)await db.query('select private.refresh_place_terms($1)',[r.value.id]);
    const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    await db.exec('set role service_role');
    const started=performance.now();report.import=await applyManifest(manifest.records,run);report.import_ms=Math.round(performance.now()-started);
    const catalogueSnapshot=await rows('select id,provider_id,name,center_lat,center_lng,west,south,east,north from discovery_places order by id');
    const rerunStarted=performance.now();report.rerun=await applyManifest(manifest.records,run);report.rerun_ms=Math.round(performance.now()-rerunStarted);
    equal(report.rerun.inserted,0);equal(report.rerun.linked,manifest.records.length);
    equal(await rows('select id,provider_id,name,center_lat,center_lng,west,south,east,north from discovery_places order by id'),catalogueSnapshot);
    await db.exec('reset role');
    await db.exec('vacuum analyze discovery_places');
    await db.exec('vacuum analyze discovery_place_terms');
    report.searches=[];
    const queries=['Soweto','Sowteo','Sowe','Khayelitsha','Mthatha','Bloemfontein','Johannesburg','Durban','Polokwane','Mbombela','Mahikeng','Kimberley','Cape Town','Port Elizabeth','Gqeberha','Mfuleni'];
    await db.exec('set role anon');
    for(const query of queries) {const t=performance.now();const result=await rows('select * from search_discovery_places($1)',[query]);assert(result.length>0,`Missing: ${query}`);checks++;report.searches.push({query,ms:Math.round(performance.now()-t),results:result.map(x=>({name:x.name,region:x.region,id:x.id}))});}
    const representatives=[['Eastern Cape','Zwide','Zihlahleni'],['Free State','Universitas','Koppies Nedersetting'],['Gauteng','Yeoville','Valley Settlements'],['KwaZulu-Natal','Wentworth','Umvoti Location'],['Limpopo','Westenburg','Zebedielas Location'],['Mpumalanga','Ferrobank','Graigieburn'],['North West','Thlabane','Boskop'],['Northern Cape','Beaconsfield','Loubos'],['Western Cape','Rondebosch','Boggomsbaai']];
    for(const [province,...names] of representatives) for(const name of names){const query=name+' '+province;const result=await rows('select * from search_discovery_places($1)',[query]);assert(result.some(r=>r.name===name&&r.region.includes(province)),`Missing representative: ${query}`);checks++;report.searches.push({query,results:result.map(x=>({name:x.name,region:x.region}))});}
    equal((await rows('select name from search_discovery_places($1)',['Soweto'])).filter(r=>r.name==='Soweto').length,1);
    const duplicate=await rows('select name,region from search_discovery_places($1)',['Mfuleni']);assert(new Set(duplicate.map(r=>r.region)).size>=2,'Mfuleni must retain distinct regions');checks++;
    await db.exec('reset role');
    report.terms=(await rows('select count(*) n from discovery_place_terms'))[0].n;
    report.places=(await rows('select count(*) n from discovery_places'))[0].n;
    equal(await rows('select to_jsonb(p) value from discovery_places p where id=any($1::uuid[]) order by id',[legacySnapshot.map(r=>r.value.id)]),legacySnapshot);
    report.index_plan=await rows("explain (analyze, buffers) select place_id from discovery_place_terms where term like 'sowe%'");
    report.trigram_plan=await rows("explain (analyze, buffers) select place_id from discovery_place_terms where term operator(extensions.%) 'sowteo'");
    report.token_plan=await rows("explain (analyze, buffers) select place_id from discovery_place_terms where tokens @@ to_tsquery('simple','soweto:* & gauteng:*')");
    await writeFile('.cache/national-places/sql-verification.json',JSON.stringify(report,null,2));
    for(const [key,index] of [['index_plan','prefix'],['trigram_plan','trigram'],['token_plan','tokens']])assert(report[key].some(r=>r['QUERY PLAN'].includes(`discovery_place_terms_${index}_idx`)),`Missing indexed plan: ${key}`);
    report.legacy_rows_preserved=legacySnapshot.length;
    report.checks=checks;
    await writeFile('.cache/national-places/sql-verification.json',JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify(report,null,2));
} finally {await db.close();}
