// Smaller, one-time OSM exports when the full Geofabrik PBF cannot be transferred.
// Never called by the application or by autocomplete. Cached per province.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PROVINCES, viewingBounds, validRecord } from './national-places.mjs';
const provinces=[['Eastern Cape','EC'],['Free State','FS'],['Gauteng','GP'],['KwaZulu-Natal','KZN'],['Limpopo','LP'],['Mpumalanga','MP'],['North West','NW'],['Northern Cape','NC'],['Western Cape','WC']];
const kinds={city:'place',town:'place',village:'locality',hamlet:'locality',isolated_dwelling:'locality',suburb:'neighbourhood',neighbourhood:'neighbourhood',quarter:'neighbourhood'};
export function recordsFromExport(data,province,source) {
  if(!PROVINCES.includes(province)||!Array.isArray(data.elements)||data.remark)throw new Error('Incomplete OSM export');
  const records=[],rejected=[];
  for(const element of data.elements) {
    const tags=element.tags??{},kind=kinds[tags.place],id=`osm:${element.type}:${element.id}`;
    if(!kind||!tags.name||['abandoned:place','disused:place','demolished:place'].some(k=>k in tags))continue;
    const b=element.bounds;
    const lat=element.lat??element.center?.lat??(b?(b.minlat+b.maxlat)/2:NaN),lng=element.lon??element.center?.lon??(b?(b.minlon+b.maxlon)/2:NaN);
    const bounds=b?{west:b.minlon,south:b.minlat,east:b.maxlon,north:b.maxlat}:viewingBounds(lat,lng);
    const municipality=tags['is_in:municipality']??null;
    const region=[municipality,province,'South Africa'].filter(Boolean).join(', ');
    const aliases=[...new Set(Object.entries(tags).filter(([key])=>['alt_name','old_name','short_name','official_name'].includes(key)||key.startsWith('name:')).flatMap(([,name])=>name.split(';')).map(x=>x.trim()).filter(x=>x&&x.length<=200))].slice(0,100);
    const record={provider_id:id,level:kind,name:tags.name,country_code:'ZA',province,municipality,region,full_address:tags.name+', '+region,
      center_lat:lat,center_lng:lng,...bounds,extent_kind:b?'source':'viewport',aliases,
      sources:[{id,url:source.url,license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',downloaded_at:source.downloaded_at,sha256:source.sha256,place_type:tags.place,query:source.query,osm_timestamp:data.osm3s?.timestamp_osm_base}]};
    if(/^\d+$/.test(tags['geonames:id']??''))record.geonames_id=tags['geonames:id'];
    if(validRecord(record))records.push(record);else rejected.push({source_id:id,reason:'Invalid OSM place geometry or name'});
  }
  return {records,rejected};
}
async function main() {
  const dirIndex=process.argv.indexOf('--dir');
  const dir=path.resolve(dirIndex<0?'.cache/national-places':process.argv[dirIndex+1]),endpoint='https://overpass-api.de/api/interpreter';
  await mkdir(path.join(dir,'osm-exports'),{recursive:true});
  const records=[],rejected=[],snapshots=[];
  for(const [province,code] of provinces){
    const file=path.join(dir,'osm-exports',code+'.json'),info=file+'.source.json';let data,source;
    try{const bytes=await readFile(file);data=JSON.parse(bytes.toString('utf8'));source=JSON.parse(await readFile(info,'utf8'));if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw new Error(`Source checksum mismatch: ${file}`);}
    catch(error){if(error.code!=='ENOENT')throw error;
      const query=`[out:json][timeout:90][maxsize:134217728];area["ISO3166-2"="ZA-${code}"]["admin_level"="4"]->.province;nwr["place"~"^(city|town|village|hamlet|isolated_dwelling|suburb|neighbourhood|quarter)$"](area.province);out body bb;`;
      console.log(`Exporting ${province}`);
      const url=endpoint+'?'+new URLSearchParams({data:query});
      let response;
      for(let attempt=0;attempt<3;attempt++) {
        response=await fetch(url,{signal:AbortSignal.timeout(120000),headers:{'User-Agent':'Pinpoint catalogue preparation (one-time cached OSM export)'}});
        if(response.status!==429&&response.status!==503)break;
        if(attempt===2)break;
        const delay=Math.min(60,Math.max(30,Number(response.headers.get('retry-after'))||30));
        console.log(`OSM export cooling down for ${delay}s`);
        await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,delay*1000));
      }
      if(!response.ok)throw new Error(`OSM export failed: ${response.status}`);
      const text=await response.text();data=JSON.parse(text);if(data.remark||!data.elements?.length)throw new Error(`Incomplete ${province} export`);
      source={url:endpoint,query,downloaded_at:new Date().toISOString(),sha256:createHash('sha256').update(text).digest('hex')};
      await writeFile(file,text);await writeFile(info,JSON.stringify(source,null,2));
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    const result=recordsFromExport(data,province,source);records.push(...result.records);rejected.push(...result.rejected);snapshots.push({province,...source,records:result.records.length});
  }
  const byId=new Map(),conflicts=new Set();
  for(const r of records){if(byId.has(r.provider_id)&&byId.get(r.provider_id).province!==r.province)conflicts.add(r.provider_id);else byId.set(r.provider_id,r);}
  for(const id of conflicts){byId.delete(id);rejected.push({source_id:id,reason:'Ambiguous province membership'});}
  await writeFile(path.join(dir,'osm-places.json'),JSON.stringify({records:[...byId.values()],rejected,snapshots},null,2));
  const snapshot=JSON.parse(await readFile(path.join(dir,'snapshot.json'),'utf8'));
  snapshot.osm={format:'overpass-provincial-exports',url:endpoint,exports:snapshots,prepared_sha256:createHash('sha256').update(await readFile(path.join(dir,'osm-places.json'))).digest('hex')};
  await writeFile(path.join(dir,'snapshot.json'),JSON.stringify(snapshot,null,2));
  const boundaryFile=path.join(dir,'osm-provinces.json'),boundaryInfo=boundaryFile+'.source.json';
  try {const raw=await readFile(boundaryFile),info=JSON.parse(await readFile(boundaryInfo,'utf8'));if(createHash('sha256').update(raw).digest('hex')!==info.sha256)throw new Error('Province source checksum mismatch');}
  catch(error){if(error.code!=='ENOENT')throw error;
    const query='[out:json][timeout:90][maxsize:134217728];('+provinces.map(([,code])=>`relation["ISO3166-2"="ZA-${code}"]["admin_level"="4"];`).join('')+');out geom;';
    const response=await fetch(endpoint+'?'+new URLSearchParams({data:query}),{signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error(`Province export failed: ${response.status}`);
    const raw=await response.text(),data=JSON.parse(raw);if(data.remark||data.elements?.length!==9)throw new Error('Incomplete province export');
    await writeFile(boundaryFile,raw);await writeFile(boundaryInfo,JSON.stringify({url:endpoint,query,downloaded_at:new Date().toISOString(),sha256:createHash('sha256').update(raw).digest('hex')},null,2));
  }
  console.log(JSON.stringify({records:byId.size,rejected:rejected.length,provinces:snapshots.map(s=>({province:s.province,records:s.records}))},null,2));
}
if(process.argv[1]?.endsWith('export-osm-places.mjs'))main().catch(e=>{console.error(e.message);process.exitCode=1;});
