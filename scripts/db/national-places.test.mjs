import test from 'node:test';
import assert from 'node:assert/strict';
import { applyManifest, combineSources, parseGeoNames, viewingBounds, validRecord, verifyProvinceCentres, PROVINCES } from './national-places.mjs';
import { recordsFromExport } from './export-osm-places.mjs';
const snapshot={downloaded_at:'2026-10-11T00:00:00Z',sha256:'test-snapshot'};
const line=(id,name,code='PPL',lat='-26.2678',country='ZA')=>[id,name,name,'Alias',lat,'27.8585','P',code,country,'','06','JHB','','','1'].join('\t');
const parse=text=>parseGeoNames(text,'ZA.06\tGauteng','ZA.06.JHB\tJohannesburg',snapshot);
test('adm context, populated types and 10km viewing boxes use real source coordinates',()=>{
  const {records,rejected}=parse([line('1','Soweto'),line('2','Abandoned','PPLQ'),line('3','Foreign','PPL','-26','LS'),line('4','Bad','PPL','NaN')].join('\n'));
  assert.equal(records.length,1);assert.equal(rejected.length,1);assert.equal(records[0].province,'Gauteng');assert.equal(records[0].municipality,'Johannesburg');assert(validRecord(records[0]));
  const b=viewingBounds(-26,28);assert(Math.abs((b.north-b.south)*111.32-10)<0.001);
});
test('explicit source links merge, names alone do not, and conflicts are quarantined',()=>{
  const [gn]=parse(line('1','Soweto')).records;
  const osm={...gn,provider_id:'osm:node:2',sources:[{...gn.sources[0],id:'osm:node:2',license:'ODbL-1.0'}]};
  const unreviewed=combineSources([gn],[osm]);assert.equal(unreviewed.records.length,1);assert.equal(unreviewed.records[0].sources.length,1);assert.equal(unreviewed.rejected.length,1);
  const far={...osm,center_lng:28.5,...viewingBounds(osm.center_lat,28.5)};
  assert.equal(combineSources([gn],[far]).records.length,2);
  const linked=combineSources([gn],[{...osm,geonames_id:'1'}]);assert.equal(linked.records.length,1);assert.equal(linked.records[0].sources.length,2);
  assert.equal(combineSources([gn],[{...osm,geonames_id:'1',province:'Western Cape'}]).rejected.length,1);
  assert.throws(()=>combineSources([gn],[{...osm,geonames_id:'1'}],{'geonames:1':{target_id:'00000000-0000-4000-8000-000000000001',evidence:'reviewed'},'osm:node:2':{target_id:'00000000-0000-4000-8000-000000000002',evidence:'reviewed'}}),/Conflicting/);
  assert.throws(()=>combineSources([gn],[osm],{'osm:node:2':{source_id:'geonames:1'}}),/Invalid reviewed mapping/);
});
test('invalid manifests fail before any batch is written',async()=>{
  let calls=0;await assert.rejects(applyManifest([{name:'invented'}],async()=>{calls++;}),/invalid/);assert.equal(calls,0);
});
test('OSM exports retain supplied bounds and aliases and reject partial exports',()=>{
  const source={url:'https://overpass-api.de/api/interpreter',...snapshot};
  const data={elements:[{type:'node',id:5,lat:-26,lon:28,tags:{place:'suburb',name:'Area','name:en':'Alias'}},{type:'way',id:6,bounds:{minlat:-26.1,maxlat:-25.9,minlon:27.9,maxlon:28.1},tags:{place:'suburb',name:'Bounded Area'}},{type:'node',id:7,lat:-26,lon:28,tags:{place:'town',name:'Disused','disused:place':'town'}}]};
  const result=recordsFromExport(data,'Gauteng',source);assert.equal(result.records.length,2);assert.equal(result.records[0].extent_kind,'viewport');assert.equal(result.records[1].extent_kind,'source');assert.deepEqual(result.records[0].aliases,['Alias']);
  assert.throws(()=>recordsFromExport({remark:'timeout',elements:[]},'Gauteng',source),/Incomplete/);
});

test('coordinate/province conflicts are quarantined without guessing a new label',()=>{
  const [record]=parse(line('1','Soweto')).records;
  const boundaries={type:'FeatureCollection',features:PROVINCES.map((province,i)=>({type:'Feature',properties:{province},geometry:{type:'Polygon',coordinates:[province==='Gauteng'?[[27,-27],[29,-27],[29,-25],[27,-25],[27,-27]]:[[40+i,0],[40+i+.5,0],[40+i+.5,1],[40+i,1],[40+i,0]]]}}))};
  const result=verifyProvinceCentres([record,{...record,provider_id:'geonames:2',province:'Limpopo'}],boundaries);
  assert.equal(result.records.length,1);assert.equal(result.rejected[0].reported_province,'Limpopo');assert.deepEqual(result.rejected[0].coordinate_provinces,['Gauteng']);
  assert.throws(()=>verifyProvinceCentres([record],{...boundaries,features:boundaries.features.slice(1)}),/nine provinces/);
});
