import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
import { downloadFile } from './download-file.mjs';

export const PROVINCES = ['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];
export const SOURCES = {
  geonames: { url: 'https://download.geonames.org/export/dump/ZA.zip', license: 'CC-BY-4.0', attribution: 'GeoNames, https://www.geonames.org/' },
  osm: { url: 'https://download.geofabrik.de/africa/south-africa-latest.osm.pbf', license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors, https://www.openstreetmap.org/copyright' },
};
export function viewingBounds(lat, lng) {
  const dy = 5 / 111.32, dx = dy / Math.cos(lat * Math.PI / 180);
  return { west: lng-dx, south: lat-dy, east: lng+dx, north: lat+dy };
}
export function normalize(value) { return value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en-ZA').replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
const aliases = values => [...new Set(values.map(x => x.trim()).filter(x => x && x.length<=200))].slice(0,100);
const provenance = (source, id, downloadedAt, sha256) => ({ id, ...SOURCES[source], downloaded_at: downloadedAt, sha256 });
export function validRecord(record) {
  return record.country_code==='ZA' && PROVINCES.includes(record.province) && typeof record.name==='string' && record.name.trim().length>0 && record.name.length<=200 &&
    ['place','locality','neighbourhood','municipality'].includes(record.level) &&
    [record.center_lat,record.center_lng,record.west,record.south,record.east,record.north].every(Number.isFinite) &&
    record.center_lat>=-35 && record.center_lat<=-22 && record.center_lng>=16 && record.center_lng<=33 &&
    record.west<record.east && record.south<record.north && record.center_lng>=record.west && record.center_lng<=record.east && record.center_lat>=record.south && record.center_lat<=record.north &&
    ['source','viewport'].includes(record.extent_kind) && Array.isArray(record.aliases) && record.aliases.length<=100 && record.aliases.every(x=>typeof x==='string' && x.length<=200) &&
    Array.isArray(record.sources) && record.sources.length>0 && record.sources.every(x=>/^(geonames:\d+|osm:(node|way|relation):\d+)$/.test(x.id) && /^https:\/\//.test(x.url) && ['CC-BY-4.0','ODbL-1.0'].includes(x.license) && x.downloaded_at && x.sha256);
}
export function parseGeoNames(text, admin1, admin2, snapshot) {
  const codes = source => new Map(source.trim().split(/\r?\n/).map(line=>{ const row=line.split('\t'); return [row[0],row[1]]; }));
  const provinces=codes(admin1), districts=codes(admin2), lines=text.trim().split(/\r?\n/).map(line=>line.split('\t'));
  const municipal = new Map(lines.filter(r=>r[8]==='ZA' && r[6]==='A' && ['ADM3','ADM4'].includes(r[7])).map(r=>[r.slice(8,9).concat(r.slice(10,14)).join('.'),r[1]]));
  const allowed=new Set(['PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLA5','PPLC','PPLF','PPLG','PPLL','PPLR','PPLX']);
  const result=[], rejected=[];
  for (const r of lines) {
    if (r[8]!=='ZA' || r[6]!=='P' || !allowed.has(r[7])) continue;
    const lat=Number(r[4]),lng=Number(r[5]),province=provinces.get(`ZA.${r[10]}`);
    const keys=[`ZA.${r[10]}.${r[11]}.${r[12]}.${r[13]}`,`ZA.${r[10]}.${r[11]}.${r[12]}.`];
    const municipality=keys.map(k=>municipal.get(k)).find(Boolean) || districts.get(`ZA.${r[10]}.${r[11]}`) || null;
    const record={ provider_id:`geonames:${r[0]}`, level:r[7]==='PPLX'?'neighbourhood':r[7]==='PPLL'||r[7]==='PPLF'?'locality':'place',
      name:r[1],country_code:'ZA',province,municipality, region:[municipality,province,'South Africa'].filter(Boolean).join(', '),
      full_address:[r[1],municipality,province,'South Africa'].filter(Boolean).join(', '),
      center_lat:lat,center_lng:lng,...viewingBounds(lat,lng),extent_kind:'viewport', aliases:aliases([r[2],...r[3].split(',')]),
      sources:[{...provenance('geonames',`geonames:${r[0]}`,snapshot.downloaded_at,snapshot.sha256),feature_code:r[7],modified_at:r[18]||null}] };
    if (validRecord(record)) result.push(record); else rejected.push({source_id:record.provider_id,reason:'Invalid coordinates, province, name or provenance'});
  }
  return { records:result,rejected };
}
export function verifyProvinceCentres(records, boundaries) {
  const features=boundaries?.features;
  if(boundaries?.type!=='FeatureCollection' || !Array.isArray(features) || features.length!==9 ||
    new Set(features.map(f=>f.properties?.province)).size!==9 || features.some(f=>!PROVINCES.includes(f.properties?.province))) throw new Error('Valid geometry for all nine provinces is required');
  const polygons=features.flatMap(f=>{
    const geometry=f.geometry;
    if(!['Polygon','MultiPolygon'].includes(geometry?.type))throw new Error('Invalid province polygon');
    return (geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates).map(rings=>{
      if(!rings.length||rings.some(r=>r.length<4||r.some(p=>p.length<2||!p.slice(0,2).every(Number.isFinite))))throw new Error('Invalid province ring');
      const points=rings[0];return {province:f.properties.province,rings,west:Math.min(...points.map(p=>p[0])),east:Math.max(...points.map(p=>p[0])),south:Math.min(...points.map(p=>p[1])),north:Math.max(...points.map(p=>p[1]))};
    });
  });
  const inRing=(x,y,ring)=>{
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const [a,b]=ring[j],[c,d]=ring[i];
      if(Math.abs((x-a)*(d-b)-(y-b)*(c-a))<1e-10&&x>=Math.min(a,c)&&x<=Math.max(a,c)&&y>=Math.min(b,d)&&y<=Math.max(b,d))return true;
      if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
    }return inside;
  };
  const accepted=[],rejected=[];
  for(const record of records){
    const x=record.center_lng,y=record.center_lat;
    const matches=[...new Set(polygons.filter(p=>x>=p.west&&x<=p.east&&y>=p.south&&y<=p.north&&inRing(x,y,p.rings[0])&&!p.rings.slice(1).some(r=>inRing(x,y,r))).map(p=>p.province))];
    if(matches.length===1&&matches[0]===record.province)accepted.push(record);
    else rejected.push({source_id:record.provider_id,reason:'Centre disagrees with sourced province geometry',reported_province:record.province,coordinate_provinces:matches});
  }
  return {records:accepted,rejected};
}
export function combineSources(geonames, osm, mappings={}) {
  for(const [id,mapping] of Object.entries(mappings)) {
    if(!/^(geonames:\d+|osm:(node|way|relation):\d+)$/.test(id) || !mapping.evidence ||
      (mapping.source_id && !/^geonames:\d+$/.test(mapping.source_id)) ||
      (mapping.target_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapping.target_id))) throw new Error(`Invalid reviewed mapping: ${id}`);
  }
  const records=geonames.map(r=>structuredClone(r)), bySource=new Map(records.flatMap(r=>r.sources.map(s=>[s.id,r]))), rejected=[];
  const primaryNames=new Map();
  for(const r of records)for(const name of [r.name,...r.aliases]){const key=`${r.province}|${normalize(name)}`;primaryNames.set(key,[...(primaryNames.get(key)??[]),r]);}
  const distance=(a,b)=>Math.hypot((a.center_lat-b.center_lat)*111.32,(a.center_lng-b.center_lng)*111.32*Math.cos(a.center_lat*Math.PI/180));
  for (const original of osm) {
    if (!validRecord(original)) { rejected.push({source_id:original.provider_id,reason:'Invalid OSM place'}); continue; }
    const r=structuredClone(original), explicit=r.geonames_id ? `geonames:${r.geonames_id}` : mappings[r.provider_id]?.source_id;
    const existing=explicit ? bySource.get(explicit) : null;
    if (explicit && !existing) { rejected.push({source_id:r.provider_id,reason:'Explicit link target missing'}); continue; }
    if (existing) {
      // Source cross-links still need geographically plausible coordinates.
      const km=distance(r,existing);
      if (r.province!==existing.province || km>15) { rejected.push({source_id:r.provider_id,reason:'Conflicting explicit link geography'}); continue; }
      existing.aliases=aliases([...existing.aliases,r.name,...r.aliases]);
      existing.sources.push(...r.sources);
      if (r.extent_kind==='source') Object.assign(existing,{center_lat:r.center_lat,center_lng:r.center_lng,west:r.west,south:r.south,east:r.east,north:r.north,extent_kind:'source'});
      bySource.set(r.provider_id,existing);
    } else {
      const near=(primaryNames.get(`${r.province}|${normalize(r.name)}`)??[]).filter(gn=>distance(r,gn)<=3);
      if(near.length&&!mappings[r.provider_id]?.target_id) {
        // Quarantine possible duplicates without merging identities or adding
        // their aliases to another record. A reviewed link can admit them later.
        rejected.push({source_id:r.provider_id,reason:'Possible duplicate requires reviewed mapping',candidates:near.map(gn=>gn.provider_id)});
        continue;
      }
      delete r.geonames_id; records.push(r); bySource.set(r.provider_id,r);
    }
  }
  for (const r of records) {
    const targets=[...new Set(r.sources.map(s=>mappings[s.id]?.target_id).filter(Boolean))];
    if (targets.length>1) throw new Error(`Conflicting reviewed UUID mappings: ${r.provider_id}`);
    if (targets.length) r.target_id=targets[0];
  }
  // Same-name records are reported, never silently merged.
  const names=new Map();
  for (const r of records) { const key=`${r.province}|${normalize(r.name)}`; names.set(key,[...(names.get(key)??[]),r.provider_id]); }
  return { records,rejected,duplicate_candidates:[...names].filter(([,ids])=>ids.length>1).map(([name,source_ids])=>({name,source_ids})) };
}
export function coverage(records) {
  const provinces=Object.fromEntries(PROVINCES.map(p=>[p,{total:0,types:{},source_types:{}}]));
  for (const r of records) { const p=provinces[r.province]; p.total++; p.types[r.level]=(p.types[r.level]??0)+1;for(const source of r.sources){const kind=source.feature_code??source.place_type??'unspecified';p.source_types[kind]=(p.source_types[kind]??0)+1;} }
  return { total:records.length,provinces,source_extents:records.filter(r=>r.extent_kind==='source').length,viewing_extents:records.filter(r=>r.extent_kind==='viewport').length };
}
async function download(url, output) {
  const result=await downloadFile(url,output);
  const bytes=await readFile(output);
  return {url,...result,downloaded_at:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex')};
}
export async function applyManifest(records, runBatch) {
  if (!records.every(validRecord)) throw new Error('Manifest contains invalid records');
  const result={inserted:0,linked:0,batches:0};
  for (let offset=0;offset<records.length;offset+=250) { const r=await runBatch(records.slice(offset,offset+250)); result.inserted+=r.inserted;result.linked+=r.linked;result.batches++; }
  return result;
}
async function main() {
  const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
  const dir=path.resolve(value('--dir','.cache/national-places'));
  await mkdir(dir,{recursive:true});
  if (args.includes('--download')) {
    const snapshot={};
    for (const [key,url,file] of [['geonames',SOURCES.geonames.url,'ZA.zip'],['admin1','https://download.geonames.org/export/dump/admin1CodesASCII.txt','admin1.txt'],['admin2','https://download.geonames.org/export/dump/admin2Codes.txt','admin2.txt'],...args.includes('--geonames-only')?[]:[['osm',SOURCES.osm.url,'south-africa.osm.pbf']]]) {
      console.log(`Downloading ${key}`); snapshot[key]=await download(url,path.join(dir,file));
      await writeFile(path.join(dir,'snapshot.json'),JSON.stringify(snapshot,null,2));
    }
    return;
  }
  if (args.includes('--prepare')) {
    const snapshot=JSON.parse(await readFile(path.join(dir,'snapshot.json'),'utf8'));
    for(const [key,file] of [['geonames','ZA.zip'],['admin1','admin1.txt'],['admin2','admin2.txt']]) {
      const digest=createHash('sha256').update(await readFile(path.join(dir,file))).digest('hex');
      if(digest!==snapshot[key]?.sha256)throw new Error(`Source checksum mismatch: ${file}`);
    }
    const zip=await JSZip.loadAsync(await readFile(path.join(dir,'ZA.zip')));
    const gn=parseGeoNames(await zip.file('ZA.txt').async('string'),await readFile(path.join(dir,'admin1.txt'),'utf8'),await readFile(path.join(dir,'admin2.txt'),'utf8'),snapshot.geonames);
    const osmBytes=await readFile(path.join(dir,'osm-places.json'));
    if(createHash('sha256').update(osmBytes).digest('hex')!==snapshot.osm?.prepared_sha256)throw new Error('Prepared OSM checksum mismatch; re-run offline extraction');
    const osm=JSON.parse(osmBytes.toString('utf8'));
    const boundaryBytes=await readFile(path.join(dir,'province-boundaries.geojson'));
    if(createHash('sha256').update(boundaryBytes).digest('hex')!==snapshot.province_boundaries?.prepared_sha256)throw new Error('Province geometry checksum mismatch');
    const boundaries=JSON.parse(boundaryBytes.toString('utf8'));
    const gnVerified=verifyProvinceCentres(gn.records,boundaries),osmVerified=verifyProvinceCentres(osm.records,boundaries);
    const mappings=value('--mappings',null) ? JSON.parse(await readFile(value('--mappings'),'utf8')) : {};
    const combined=combineSources(gnVerified.records,osmVerified.records,mappings);
    const report={...coverage(combined.records),coordinates_checked_against_province_geometry:true,sources:snapshot,rejected:[...gn.rejected,...osm.rejected,...gnVerified.rejected,...osmVerified.rejected,...combined.rejected],duplicate_candidates:combined.duplicate_candidates};
    if (Object.values(report.provinces).some(p=>p.total===0)) throw new Error('Coverage missing a province');
    await writeFile(path.join(dir,'manifest.json'),JSON.stringify({version:1,records:combined.records,attribution:Object.values(SOURCES),snapshots:snapshot},null,2));
    await writeFile(path.join(dir,'coverage.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({...coverage(combined.records),invalid_records:report.rejected.filter(r=>r.reason!=='Possible duplicate requires reviewed mapping').length,quarantined_duplicates:report.rejected.filter(r=>r.reason==='Possible duplicate requires reviewed mapping').length,duplicate_candidates:report.duplicate_candidates.length},null,2)); return;
  }
  const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
  if (!args.includes('--apply')) { console.log(JSON.stringify({mode:'preview',...coverage(manifest.records),invalid:manifest.records.filter(r=>!validRecord(r)).length},null,2)); return; }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('An explicit target URL and service-role key are required');
  if (!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname) && !args.includes('--allow-remote')) throw new Error('Remote import requires --allow-remote after release approval');
  const {createClient}=await import('@supabase/supabase-js'); const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  console.log(JSON.stringify(await applyManifest(manifest.records,async records=>{const {data,error}=await db.rpc('import_discovery_place_batch',{records});if(error)throw error;return data;})));
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1;});
