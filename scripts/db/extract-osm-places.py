"""Offline extraction from Geofabrik's South Africa PBF; no geocoding API calls.
Install scripts/db/national-places-requirements.txt in a task-specific environment.
"""
import argparse
import json
import math
import hashlib
from pathlib import Path
import osmium
from shapely import wkb
from shapely.geometry import Point, mapping
from shapely.strtree import STRtree

PROVINCES = {'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'}
KINDS = {'city': 'place', 'town': 'place', 'village': 'locality', 'hamlet': 'locality', 'isolated_dwelling': 'locality', 'suburb': 'neighbourhood', 'neighbourhood': 'neighbourhood', 'quarter': 'neighbourhood'}
URL = 'https://download.geofabrik.de/africa/south-africa-latest.osm.pbf'

class Places(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.places, self.boundaries, self.rejected = [], [], []
        self.factory = osmium.geom.WKBFactory()

    def record(self, obj, lat, lng, kind, bounds=None):
        tags = dict(obj.tags)
        if tags.get('place') not in KINDS or not tags.get('name'):
            return
        if any(k in tags for k in ('abandoned:place', 'disused:place', 'demolished:place')):
            return
        self.places.append({'id': f'osm:{kind}:{obj.orig_id() if kind != "node" else obj.id}', 'tags': tags, 'lat': lat, 'lng': lng, 'bounds': bounds})

    def node(self, obj):
        if obj.location.valid():
            self.record(obj, obj.location.lat, obj.location.lon, 'node')

    def area(self, obj):
        tags = dict(obj.tags)
        boundary = tags.get('boundary') == 'administrative' and tags.get('admin_level') in ('4', '6', '8')
        if not boundary and tags.get('place') not in KINDS:
            return
        try:
            geom = wkb.loads(self.factory.create_multipolygon(obj), hex=True)
            if geom.is_empty or not geom.is_valid:
                raise ValueError('Invalid source geometry')
            if boundary:
                self.boundaries.append((geom, tags.get('name:en', tags.get('name', '')), tags['admin_level']))
            if tags.get('place') in KINDS:
                centre = geom.representative_point()
                self.record(obj, centre.y, centre.x, 'way' if obj.from_way() else 'relation', list(geom.bounds))
        except (RuntimeError, ValueError) as error:
            self.rejected.append({'source_id': str(obj.orig_id()), 'reason': str(error)})

def extract(pbf, snapshot):
    handler = Places()
    handler.apply_file(str(pbf), locations=True, idx='flex_mem')
    provinces = [(g, n) for g, n, level in handler.boundaries if level == '4' and n in PROVINCES]
    municipalities = [(g, n) for g, n, level in handler.boundaries if level in ('6', '8')]
    if {n for _, n in provinces} != PROVINCES:
        raise ValueError('OSM extract does not contain valid boundaries for every province')
    province_tree, municipality_tree = STRtree([g for g, _ in provinces]), STRtree([g for g, _ in municipalities])
    records = []
    for row in handler.places:
        point = Point(row['lng'], row['lat'])
        matches = [int(i) for i in province_tree.query(point) if provinces[int(i)][0].covers(point)]
        if len(matches) != 1:
            handler.rejected.append({'source_id': row['id'], 'reason': 'Outside ZA province geometry or ambiguous province'})
            continue
        province = provinces[matches[0]][1]
        local = [int(i) for i in municipality_tree.query(point) if municipalities[int(i)][0].covers(point)]
        municipality = municipalities[min(local, key=lambda i: municipalities[i][0].area)][1] if local else None
        tags, lat, lng = row['tags'], row['lat'], row['lng']
        names = [tags[k] for k in tags if k in ('alt_name', 'old_name', 'short_name', 'official_name') or k.startswith('name:')]
        aliases = list(dict.fromkeys(n.strip() for name in names for n in name.split(';') if n.strip() and len(n.strip()) <= 200))[:100]
        bounds = row['bounds']
        if bounds is None:
            dy = 5 / 111.32
            dx = dy / math.cos(math.radians(lat))
            bounds = [lng - dx, lat - dy, lng + dx, lat + dy]
        context = ', '.join(x for x in [municipality, province, 'South Africa'] if x)
        record = {'provider_id': row['id'], 'level': KINDS[tags['place']], 'name': tags['name'], 'country_code': 'ZA', 'province': province,
                  'municipality': municipality, 'region': context, 'full_address': tags['name'] + ', ' + context, 'center_lat': lat, 'center_lng': lng,
                  'west': bounds[0], 'south': bounds[1], 'east': bounds[2], 'north': bounds[3], 'extent_kind': 'source' if row['bounds'] else 'viewport', 'aliases': aliases,
                  'sources': [{'id': row['id'], 'url': URL, 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors', 'downloaded_at': snapshot['downloaded_at'], 'sha256': snapshot['sha256'], 'place_type': tags['place']} ]}
        if tags.get('geonames:id', '').isdigit():
            record['geonames_id'] = tags['geonames:id']
        records.append(record)
    return {'records': records, 'rejected': handler.rejected, 'province_boundaries': sorted({n for _, n in provinces}),
            'boundary_geojson': {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'province': n}, 'geometry': mapping(g)} for g, n in provinces]}}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', default='.cache/national-places')
    args = parser.parse_args()
    directory = Path(args.dir)
    snapshot = json.loads((directory / 'snapshot.json').read_text(encoding='utf-8'))
    if hashlib.file_digest((directory / 'south-africa.osm.pbf').open('rb'), 'sha256').hexdigest() != snapshot['osm']['sha256']:
        raise ValueError('PBF source checksum mismatch')
    result = extract(directory / 'south-africa.osm.pbf', snapshot['osm'])
    boundary_file = directory / 'province-boundaries.geojson'
    boundary_file.write_text(json.dumps(result.pop('boundary_geojson')), encoding='utf-8')
    snapshot['province_boundaries'] = {**snapshot['osm'], 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors', 'prepared_sha256': hashlib.sha256(boundary_file.read_bytes()).hexdigest()}
    (directory / 'osm-places.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    snapshot['osm']['prepared_sha256'] = hashlib.sha256((directory / 'osm-places.json').read_bytes()).hexdigest()
    (directory / 'snapshot.json').write_text(json.dumps(snapshot, indent=2), encoding='utf-8')
    print(json.dumps({'records': len(result['records']), 'rejected': len(result['rejected']), 'provinces': result['province_boundaries']}))
