"""Convert the cached OSM province relations to validated offline GeoJSON."""
import argparse
import hashlib
import json
from pathlib import Path
from shapely.geometry import LineString, mapping
from shapely.ops import polygonize_full, unary_union
PROVINCES = {'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'}


def prepare(directory):
    raw = (directory / 'osm-provinces.json').read_bytes()
    source = json.loads((directory / 'osm-provinces.json.source.json').read_text(encoding='utf-8'))
    if hashlib.sha256(raw).hexdigest() != source['sha256']:
        raise ValueError('Province source checksum mismatch')
    data = json.loads(raw)
    if data.get('remark') or len(data.get('elements', [])) != 9:
        raise ValueError('Incomplete province geometry export')
    features = []
    for relation in data['elements']:
        name = relation['tags'].get('name:en', relation['tags']['name'])
        if name not in PROVINCES:
            raise ValueError('Unrecognized province')
        lines = {role: [LineString([(p['lon'], p['lat']) for p in member['geometry']]) for member in relation['members']
                       if member['type'] == 'way' and member['role'] == role] for role in ('outer', 'inner')}
        geometries = {}
        for role in ('outer', 'inner'):
            polygons, cuts, dangles, invalid = polygonize_full(lines[role])
            if not cuts.is_empty or not dangles.is_empty or not invalid.is_empty:
                raise ValueError(f'Incomplete {name} {role} rings')
            geometries[role] = unary_union(polygons)
        geometry = geometries['outer'].difference(geometries['inner'])
        if geometry.is_empty or not geometry.is_valid or geometry.geom_type not in ('Polygon', 'MultiPolygon'):
            raise ValueError(f'Invalid {name} geometry')
        features.append({'type': 'Feature', 'properties': {'province': name, 'source_id': f'osm:relation:{relation["id"]}'}, 'geometry': mapping(geometry)})
    if {f['properties']['province'] for f in features} != PROVINCES:
        raise ValueError('Missing province')
    output = directory / 'province-boundaries.geojson'
    output.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}), encoding='utf-8')
    snapshot = json.loads((directory / 'snapshot.json').read_text(encoding='utf-8'))
    snapshot['province_boundaries'] = {**source, 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors',
                                      'prepared_sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
    (directory / 'snapshot.json').write_text(json.dumps(snapshot, indent=2), encoding='utf-8')
    return {'provinces': len(features), 'bytes': output.stat().st_size}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', default='.cache/national-places')
    print(json.dumps(prepare(Path(parser.parse_args().dir))))
