"""Exercise the real pyosmium/shapely pipeline using an isolated OSM fixture."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('place_extraction', Path(__file__).with_name('extract-osm-places.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExtractionTest(unittest.TestCase):
    def test_province_geometry_nodes_polygons_and_history(self):
        nodes, ways, target_ids = [], [], []
        next_id = 1
        for index, province in enumerate(sorted(module.PROVINCES)):
            lng, lat = 18 + index, -30
            corners = [(lng, lat), (lng + .5, lat), (lng + .5, lat + .5), (lng, lat + .5)]
            refs = []
            for x, y in corners:
                nodes.append(f'<node id="{next_id}" lat="{y}" lon="{x}"/>')
                refs.append(next_id)
                next_id += 1
            refs.append(refs[0])
            ways.append(f'<way id="{index + 100}">' + ''.join(f'<nd ref="{ref}"/>' for ref in refs) + f'<tag k="area" v="yes"/><tag k="boundary" v="administrative"/><tag k="admin_level" v="4"/><tag k="name" v="{province}"/></way>')
            if index == 0:
                ways.append('<way id="999">' + ''.join(f'<nd ref="{ref}"/>' for ref in refs) + '<tag k="area" v="yes"/><tag k="place" v="suburb"/><tag k="name" v="Polygon fixture"/></way>')
                target_ids.append('osm:way:999')
            nodes.append(f'<node id="{next_id}" lat="{lat + .2}" lon="{lng + .2}"><tag k="place" v="village"/><tag k="name" v="Fixture {index}"/><tag k="alt_name" v="Alias {index}"/></node>')
            target_ids.append(f'osm:node:{next_id}')
            next_id += 1
        nodes.append(f'<node id="{next_id}" lat="-29.8" lon="18.2"><tag k="place" v="village"/><tag k="name" v="Disused fixture"/><tag k="disused:place" v="village"/></node>')
        next_id += 1
        nodes.append(f'<node id="{next_id}" lat="-10" lon="5"><tag k="place" v="town"/><tag k="name" v="Outside fixture"/></node>')
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'fixture.osm'
            ways.sort(key=lambda way: int(way.split('id="')[1].split('"')[0]))
            file.write_text('<osm version="0.6">' + ''.join(nodes + ways) + '</osm>', encoding='utf-8')
            result = module.extract(file, {'downloaded_at': '2026-10-11', 'sha256': 'fixture'})
        self.assertEqual(len(result['records']), 10)
        self.assertEqual({r['provider_id'] for r in result['records']}, set(target_ids))
        self.assertEqual({r['province'] for r in result['records']}, module.PROVINCES)
        self.assertEqual(sum(r['extent_kind'] == 'source' for r in result['records']), 1)
        self.assertEqual(len(result['rejected']), 1)
        self.assertEqual(len(result['boundary_geojson']['features']), 9)
        json.dumps(result)


if __name__ == '__main__':
    unittest.main()
