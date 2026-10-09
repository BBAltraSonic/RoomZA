# Live demo listings — 8 October 2026

Created five ordinary demo accounts and ten publicly discoverable listings in Rondebosch. Existing records were preserved. No schema, permission, UI or deployment changes were made.

| Category | Feed URL | Map URL |
|---|---|---|
| Property rent | [Feed](https://roomza.pinpoint-roomza.workers.dev/?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=feed&mode=rent) | [Map](https://roomza.pinpoint-roomza.workers.dev/?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=map&mode=rent) |
| Property buy | [Feed](https://roomza.pinpoint-roomza.workers.dev/?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=feed&mode=buy) | [Map](https://roomza.pinpoint-roomza.workers.dev/?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=map&mode=buy) |
| Shopping Specials | [Feed](https://roomza.pinpoint-roomza.workers.dev/offers?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=feed) | [Map](https://roomza.pinpoint-roomza.workers.dev/offers?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=map) |
| Tourism | [Feed](https://roomza.pinpoint-roomza.workers.dev/offers?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=feed&kind=tourism) | [Map](https://roomza.pinpoint-roomza.workers.dev/offers?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=map&kind=tourism) |
| Events | [Feed](https://roomza.pinpoint-roomza.workers.dev/offers?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=feed&kind=event) | [Map](https://roomza.pinpoint-roomza.workers.dev/offers?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=map&kind=event) |
| Services | [Feed](https://roomza.pinpoint-roomza.workers.dev/services?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=feed) | [Map](https://roomza.pinpoint-roomza.workers.dev/services?areaId=b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb&area=Rondebosch%2C%20City%20of%20Cape%20Town%2C%20South%20Africa&view=map) |

The current workspace uses a map-first discovery layout; legacy view=feed links may display the same map-and-card layout. Both parameter variants are provided for compatibility. Verification covers live HTTP/API responses; automated browser rendering, login and MFA were not exercised.

## Evidence

14 live checks passed: six feeds, six Shopping/Tourism/Event detail responses and two image SHA-256 checks. Anonymous SQL dry-run returned two listings per category and live/upcoming Event states, and rolled back before final publication. Original record counts/hashes across 108 tables matched after excluding captured demo rows. A full importer rerun changed no table counts or hashes.

Five new Auth users and profiles, zero new admin memberships, zero enabled external subscriptions and zero demo notification events. Required security/account-update in-app subscriptions remain enabled because of the existing database constraint; all external and optional subscriptions are disabled. Demo profiles have no verified phone/email badge or online presence. Synthetic review notes explicitly do not claim actual merchant/venue/provider authority. Fixed consent fields serve only as demo fixture scaffolding.

## Samples

- Demo Rondebosch two-bedroom apartment — 29b7d6a5-1289-4710-9867-709a59f791a4.
- Demo Rondebosch family house for sale — 27f4de6a-46c7-407b-9bd5-5f78e6f61a75.
- Demo grocery basket special — f4d3a33b-0fba-4a39-bae4-181584f3aef3; 2026-10-08T11:48:45.814Z through 2026-11-07T12:48:45.814Z (UTC).
- Demo cafe coffee and pastry special — 6eebd269-a148-411b-921c-f9eec8eb7ffe; 2026-10-08T11:48:45.814Z through 2026-11-07T12:48:45.814Z (UTC).
- Demo Rondebosch neighbourhood walking tour — b0334b23-2ae5-4c19-9a91-7805d22ed38c; 2026-10-08T11:48:45.814Z through 2026-11-07T12:48:45.814Z (UTC).
- Demo garden discovery experience — ff2b6678-4e17-4449-9b8a-28197eb6a999; 2026-10-08T11:48:45.814Z through 2026-11-07T12:48:45.814Z (UTC).
- Demo community arts exhibition — da0e58e1-1936-46a4-8ec3-9a2d6a705d1e; 2026-10-08T11:48:45.814Z through 2026-10-15T12:48:45.814Z (UTC).
- Demo upcoming weekend craft market — e57093f3-8bac-4d2f-9f59-84fbe60b0ebd; 2026-10-15T12:48:45.814Z through 2026-10-15T18:48:45.814Z (UTC).
- Demo household plumbing service — 9591f11f-4512-48bb-9f74-260c90ceae7a.
- Demo home and office cleaning service — ab133fea-bfeb-4d84-877b-e5b3d6c2a527.

Shopping/Tourism expire after 30 days. One Event is active for seven days; the upcoming Event starts in seven days and runs six hours. Property and Service demos remain until withdrawn.

## Importer, manifest and cleanup

[Importer](/C:/Users/BB/Documents/RoomZA/scripts/db/demo-live-import.mjs), [manifest](/C:/Users/BB/Documents/RoomZA/artifacts/demo-listings/2026-10-08/manifest.json), [database evidence](/C:/Users/BB/Documents/RoomZA/artifacts/demo-listings/2026-10-08/database-verification.json), [public evidence](/C:/Users/BB/Documents/RoomZA/artifacts/demo-listings/2026-10-08/public-verification.json).

The manifest includes all 212 created record keys across 29 tables, including generated audit records, as well as Storage paths and hashes. Run node --import tsx scripts/db/demo-live-import.mjs with prepare, accounts-images --apply, publication-sql, verify-public or rollback-sql. SQL output is applied through the connected Supabase SQL tool. Credentials stay in process memory; no service key or demo password is persisted. Existing fixture sets are skipped atomically; partial fixture sets are rejected.

[Rollback SQL](/C:/Users/BB/Documents/RoomZA/artifacts/demo-listings/2026-10-08/rollback.sql) is prepared but not executed. It unpublishes only captured demo IDs and retains immutable history. Do not delete historical review records or existing data. Any account retirement must first account for its captured dependencies.

## Generated images

Built-in image_gen generated these new assets; they were copied into the workspace and uploaded to demo-owned paths:

- [Rental image](/C:/Users/BB/Documents/RoomZA/artifacts/demo-listings/2026-10-08/demo-rental.png) — 33b8face-98f1-4163-bb2c-d443d4630b25/29b7d6a5-1289-4710-9867-709a59f791a4/demo-rent.png.

  Prompt: Use case: photorealistic-natural. Create one landscape real-estate card photograph of an entirely fictional two-bedroom apartment living room in Cape Town: bright comfortable neutral furnishings, wood accents, wide windows, leafy view, soft daylight, realistic modest home, horizontal composition. No people, no logos, no actual identifiable property. Include a small legible label 'DEMO · FICTIONAL PROPERTY' in the lower left within a pale unobtrusive strip. This synthetic photo will illustrate a clearly labelled demo rental listing.

- [Sale image](/C:/Users/BB/Documents/RoomZA/artifacts/demo-listings/2026-10-08/demo-sale.png) — 33b8face-98f1-4163-bb2c-d443d4630b25/27f4de6a-46c7-407b-9bd5-5f78e6f61a75/demo-sale.png.

  Prompt: Use case: photorealistic-natural. Create one landscape real-estate card photograph of an entirely fictional three-bedroom suburban Cape Town house exterior, single story cream walls, slate pitched roof, small neat green garden, mature trees, welcoming sunny afternoon light, realistic modest family home, horizontal composition. No people, no logos, no actual identifiable property, no house number. Include a small legible label 'DEMO · FICTIONAL PROPERTY' in the lower left within a pale unobtrusive strip. This synthetic photo will illustrate a clearly labelled demo property for sale.
