import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
const files = [
  "src/app/api/discovery-media/route.ts",
  "src/app/api/saved-specials/route.ts",
  "src/app/saved/page.tsx",
  "src/app/admin/services/page.tsx",
  "src/features/discovery/deal-schema.ts",
  "src/features/discovery/deal-schema.test.ts",
  "src/features/discovery/discovery-clock.tsx",
  "src/features/discovery/discovery-map.tsx",
  "src/features/discovery/feed-cards.test.tsx",
  "src/features/discovery/media-api.ts",
  "src/features/discovery/media-api.test.ts",
  "src/features/discovery/media-fields.tsx",
  "src/features/discovery/presentation-data.ts",
  "src/features/discovery/published-media.tsx",
  "src/features/discovery/saved-specials-api.ts",
  "src/features/discovery/saved-specials-api.test.ts",
  "src/features/discovery/saved-specials-client.tsx",
  "src/features/discovery/saved-specials-client.test.tsx",
  "src/features/discovery/saved-specials-grid.tsx",
  "src/features/discovery/special-card.tsx",
  "src/features/discovery/special-card.test.tsx",
  "src/features/discovery/special-card.module.css",
  "src/features/discovery/viewport-data.ts",
  "src/features/discovery/viewport-discovery-screen.tsx",
  "src/features/offers/schema.ts",
  "src/features/offers/offer-draft-editor.tsx",
  "src/features/offers/offer-draft-form.ts",
  "src/features/offers/offer-feed-card.tsx",
  "src/features/offers/offer-review-editor.tsx",
  "src/features/offers/offer-decision-editor.tsx",
  "src/features/offers/public-contract.ts",
  "src/features/offers/public-data.ts",
  "src/features/offers/public-detail-screen.tsx",
  "src/features/offers/public-feed-screen.tsx",
  "src/features/entries/schema.ts",
  "src/features/entries/entry-draft-editor.tsx",
  "src/features/entries/entry-draft-form.ts",
  "src/features/entries/entry-feed-card.tsx",
  "src/features/entries/entry-review-editor.tsx",
  "src/features/entries/public-contract.ts",
  "src/features/entries/public-data.ts",
  "src/features/entries/public-detail-screen.tsx",
  "src/features/entries/public-feed-screen.tsx",
  "src/features/entries/publication-contract.ts",
  "src/features/services/schema.ts",
  "src/features/services/data.ts",
  "src/features/services/service-feed-card.tsx",
  "src/features/services/service-workspace.tsx",
  "src/features/services/service-review-decision.tsx",
  "src/lib/supabase/types.ts",
  "scripts/db/verify-discovery-card-migration.mjs",
  "supabase/migrations/20261009124326_discovery_cards_media_saves.sql",
  "docs/discovery-cards-20261009.md"
];
const evidence = ["discovery-cards-tests-final.log", "discovery-cards-typecheck-final.log", "discovery-cards-lint-final.log", "discovery-cards-final-actions-lint.log", "discovery-cards-build-final.log", "discovery-cards-db.log", "discovery-cards-diff-check.log"];
const zip = new JSZip(), entries = [];
for (const file of files) { const bytes = await fs.readFile(file); entries.push({ path: file, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }); zip.file(file, bytes); }
for (const name of evidence) zip.file("validation/" + name, await fs.readFile(".cache/" + name));
const manifest = { createdAt: new Date().toISOString(), kind: "scoped-source-handoff", productionMigrationApplied: false, deployed: false, browserVerified: false, dependency: "20261009103541_guest_public_contacts.sql and the existing discovery baseline", includesExistingDirtyAdapterContent: true, entries };
zip.file("manifest.json", JSON.stringify(manifest,null,2));
// Check the exact source snapshot for drift before writing the bundle.
for (const entry of entries) { const bytes = await fs.readFile(entry.path); if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error("Source changed during packaging: " + entry.path); }
const directory = "artifacts/discovery-cards"; await fs.mkdir(directory,{recursive:true});
const output = path.join(directory,"discovery-cards-" + new Date().toISOString().replace(/[:.]/g,"-") + ".zip");
await fs.writeFile(output,await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}));
await fs.writeFile(output + ".manifest.json",JSON.stringify(manifest,null,2));
console.log(JSON.stringify({output:path.resolve(output),files:entries.length,bytes:(await fs.stat(output)).size}));
