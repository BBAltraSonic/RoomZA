# Nationwide South African named-area catalogue

Implemented locally on 11 October 2026. Production deployment and production database migration/import have **not** been performed. Browser verification has not been performed; the accepted plan requires fresh authorization under the existing attempt cap.

## Result and measured coverage

The prepared catalogue contains **18,252 accepted place records** across all nine provinces. GeoNames provides the primary populated-place data; OpenStreetMap adds suburbs, neighbourhoods and settlements. This is measured open-data coverage, not a guarantee that every settlement is present or that every remaining same-name record is a unique settlement.

| Province | Accepted records |
| --- | ---: |
| Eastern Cape | 5,757 |
| Free State | 1,560 |
| Gauteng | 1,573 |
| KwaZulu-Natal | 2,166 |
| Limpopo | 2,121 |
| Mpumalanga | 1,026 |
| North West | 1,172 |
| Northern Cape | 988 |
| Western Cape | 1,889 |

Coverage includes source feature codes and OSM place types, along with the application's place/neighbourhood/locality levels. GeoNames' generic populated-place code does not reliably distinguish townships from towns: those distinctions are not invented. There are 374 source extents and 17,878 generated viewing areas approximately 10 km across. Generated extents support nearby discovery and are not legal or exact suburb boundaries.

Six invalid source records, 621 province-geometry conflicts and 3,046 possible duplicates are excluded or quarantined. The report retains these gaps and 1,348 remaining same-name candidate groups for sourced review. All accepted centres were checked against downloaded province polygons. Explicit source links and reviewed mappings are the only cross-source merges; names alone never merge identity.

The public downloads are `public/data/south-africa-places.html`, the compressed catalogue and compressed coverage report alongside it. They include identifiers, source hashes, download dates and attribution. GeoNames attribution follows [its download documentation](https://download.geonames.org/export/dump/readme.txt); OSM data retains [ODbL attribution and terms](https://www.openstreetmap.org/copyright).

## Data acquisition and refresh

The complete [Geofabrik South Africa PBF](https://download.geofabrik.de/africa/south-africa.html) download repeatedly stalled. No partial PBF was used in the catalogue. The importer supports that primary extract path, but this release's actual OSM supplement uses cached, checksum-verified provincial Overpass exports of named places and the nine province relations. This is an offline preparation step; chooser requests never call Overpass or another geocoder. The snapshot explicitly records this alternate source format, queries and timestamps. It is not represented as a complete Geofabrik import.

To refresh manually, use a new directory so existing cached exports are not mistaken for a fresh snapshot:

```powershell
$catalogueDir = '.cache/national-places-YYYYMMDD'
node scripts/db/national-places.mjs --download --geonames-only --dir $catalogueDir
node scripts/db/export-osm-places.mjs --dir $catalogueDir
# Use a local Python environment with scripts/db/national-places-requirements.txt.
python scripts/db/prepare-place-boundaries.py --dir $catalogueDir
node scripts/db/national-places.mjs --prepare --dir $catalogueDir --mappings scripts/db/national-places-mappings.json
node scripts/db/national-places.mjs --dir $catalogueDir
```

For the PBF path, omit `--geonames-only` from download, then run `python scripts/db/extract-osm-places.py --dir $catalogueDir` before preparation. Both paths fail on missing province geometry, corrupt prepared files or invalid source links. Review the coverage and quarantines before admitting corrections. The default importer invocation is preview-only. `--apply` requires explicitly configured target credentials, accepts batches of at most 250 and rejects nonlocal targets unless `--allow-remote` is supplied after release approval. Never print service-role credentials or include them in release artifacts.

## Application behaviour and compatibility

Public `/api/discovery/places` keeps the existing response contract and stable UUID area IDs, adding optional extent metadata. Database functions rank exact names, name prefixes, aliases and token matches before conservative typo matches. Searches are indexed, limited to six results and use read-only anonymous access. Routes enforce input validation, rate limits, timeout/error handling and no-store responses.

The shared chooser retains a two-character minimum, 250 ms debounce, keyboard selection, cancellation, retry and recent choices. Regional labels distinguish same-name places. Server-ranked aliases and typos are no longer removed by a literal client substring filter. Shared discovery/posting choosers and Property's main named-area search use the same catalogue; posting authorization remains required. Property selection stores `areaId`, moves the map and refreshes published listing requests while preserving rent/buy and filters. A delayed previous query cannot overwrite a later selection. Street-address posting and reverse-geocoding flows are outside this change.

Place data never creates businesses, properties or other listings. An area with no published Pinpoint results remains an honest empty listing view; missing catalogue data is a separate search state.

`20261011114646_national_place_catalogue.sql` adds metadata, source-link and search-term tables rather than modifying existing place rows. Offer review/publication compares complete place JSON against saved snapshots, so adding columns to the base table would have broken compatibility. All five existing production-public place records were copied read-only into the isolated rehearsal; full base JSON, UUIDs, coordinates and base column shape were preserved. Four were explicitly linked to imported sources. Emfuleni's existing municipality record remains intact. No listing, saved-home or publication tables were changed.

## Verification evidence

The package contains the actual manifest, coverage, snapshot hashes, public legacy-place snapshot and logs. The database rehearsal uses PGlite 0.5.8 (PostgreSQL 18.3 WASM) with the real migration and 18,252-record import: **69 checks passed**, 18,248 new rows plus four existing links, then a complete rerun with zero new rows. It verifies all five original records, invalid batches, conflicting mappings, source provenance, public/authenticated read-only access, denied public writes/import, duplicate names, aliases, prefixes, misspellings and representative city/suburb/rural queries across every province. Query plans use the prefix, trigram and token indexes after analysis. Recorded local query timings are not hosted/network latency measurements.

Focused API/chooser tests, Property URL/filter/selection tests, discovery regression tests, importer tests and the real pyosmium/shapely extraction fixture pass. The extraction fixture includes nodes, a sourced polygon extent, all nine province contexts, a historical place and an outside-country rejection. Typecheck, scoped lint and the production Next build with client JavaScript budget checks pass. Logs record separate overlapping suites; their test totals must not be added as unique tests.

This does not prove hosted Supabase PostgreSQL/PostgREST execution, a complete local Supabase stack, a Workers release build or browser journeys. Those are explicit release gates. The installed Next version is 16.3.7 while the existing package declaration requests 16.3.8; this pre-existing dependency drift was not changed.

## Scoped release and rollback

The source handoff archive is `artifacts/national-places/national-places-20261011.zip`. It includes our delta against saved pre-edit files, baseline and after snapshots, new files, data, checksums and validation evidence. Some touched files already contained unrelated local work. Apply the delta in an isolated release checkout and reconcile its declared prerequisites; **do not deploy this dirty checkout or blindly replace files with the after snapshots**. Dependency snapshots are references, not additional authorized changes.

Before a separately authorized production release:

1. Capture the current deployment and database migration history again. Reconcile existing public catalogue routes, review/publication contracts and prior feature changes with the release source baseline.
2. Rehearse the scoped migration against the target PostgreSQL/Supabase version and inspect public RPC permissions and query plans. Apply only this approved migration, not all unrelated pending migrations. Import the frozen, reviewed manifest; verify existing IDs and source links before publishing the application code.
3. Build the isolated Workers artifact, run the repository release/size gates and deploy with existing bindings preserved (`--keep-vars`). Check hosted RPCs and routes, then conduct the browser journeys after fresh authorization. Verify rapid selections, reloads, category changes, empty results, existing Property deep links and saved homes.

Read-only Wrangler evidence captured deployment `bb5d4793-82c8-47df-8a62-1e50fa11cf00`, with 100% traffic on version `fab86d64-a92f-4f2d-8a32-dccf48f2fa3a` (9 October 2026). Recheck immediately before release. A future authorized code rollback can use:

```powershell
node node_modules/wrangler/bin/wrangler.js rollback fab86d64-a92f-4f2d-8a32-dccf48f2fa3a --name roomza --message "Rollback national places release" --yes
```

This command has **not** been run. [Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) does not roll back the external database. Keep the additive catalogue/source data and UUIDs after a code rollback: new places may already be referenced by posts. Do not drop tables/extensions or delete imported IDs. The archive rehearses forward and reverse source-patch application in an isolated tree with byte-for-byte hashes; it never rolls back the working checkout.
