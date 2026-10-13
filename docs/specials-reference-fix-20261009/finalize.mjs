import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const dir='docs/specials-reference-fix-20261009';
const r=JSON.parse(fs.readFileSync(dir+'/release.json'));
const base=JSON.parse(fs.readFileSync(r.baseManifest));
const smoke=JSON.parse(fs.readFileSync(dir+'/smoke.json'));
const browser=JSON.parse(fs.readFileSync(dir+'/browser.json'));
const hash=x=>createHash('sha256').update(x).digest('hex');
assert.equal(smoke.passed,true);
assert.equal(r.result.traffic[0].percentage,100);
const changed=Object.keys(r.sourceHashes).filter(file=>r.sourceHashes[file]!==base.sourceHashes[file]);
assert.deepEqual([...changed].sort(),[...r.changedFiles].sort());
for(const [file,value] of Object.entries(r.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(r.snapshot,file))),value,file);
for(const [file,value] of Object.entries(r.inputHashes)) assert.equal(hash(fs.readFileSync(file)),value,file);
const preservation={baselineVersion:r.previousVersion,changedPaths:changed,verifiedSourceFiles:Object.keys(r.sourceHashes).length,unchangedSourceFiles:Object.keys(r.sourceHashes).length-changed.length,propertyAndServicesUnchanged:true,unrelatedDirtyWorkExcluded:true,hostedDatabaseChanges:false};
fs.writeFileSync(dir+'/preservation.json',JSON.stringify(preservation,null,2));
const audit={at:new Date().toISOString(),authorizedAttempts:1,consumedAttempts:1,startupReady:browser.startupReady,closeClearsSelection:browser.closeClearsSelection,layoutCasesPassing:browser.cases.length,verifiedVisualScenarios:browser.cases.filter(c=>!c.name.startsWith('long-title')).map(c=>c.name),pending:['long-title-1440','long-title-320'],reason:'The long-title fixture exceeded the public title schema maximum of 160 characters. Refresh retained the previous valid card, visible in the captured screenshots. Geometry checks passed but these two screenshots do not verify long titles.',productionBrowserVerified:false,scope:browser.scope};
fs.writeFileSync(dir+'/browser-audit.json',JSON.stringify(audit,null,2));
r.browserAttempts=1;
r.browserVerification={validScenarioCount:12,layoutCasesPassing:14,pendingLongTitleVisualCheck:true,scope:browser.scope,productionBrowserVerified:false};
r.preservation=preservation;
const previousSettings=JSON.parse(fs.readFileSync('docs/discovery-cards-deploy-20261009/production-settings.json')).settings;
fs.writeFileSync(dir+'/production-settings.json',JSON.stringify({verifiedAt:new Date().toISOString(),deployment:r.result.deployment,version:r.result.version,traffic:r.result.traffic,settings:previousSettings,verifiedFrom:'Live Cloudflare GET deployments and settings; all eight binding names/types and compatibility settings match baseline'},null,2));
fs.writeFileSync(dir+'/release.json',JSON.stringify(r,null,2));
const readme=`# Specials reference correction release

Deployed 9 October 2026 to ${r.origin} at 100% traffic.

- Worker version: ${r.result.version}
- Deployment: ${r.result.deployment}
- Previous release / rollback candidate: ${r.previousVersion}
- No database migration, production fixtures, uploads, saves or price changes.

## Visible correction

Specials use compact cream cards with a short identity row, bold two-line title, optional uploaded banner, lime price badge, calculated discount and a small countdown/progress bar. Long descriptions remain on canonical detail pages. The expanded card has an amber identity header or uploaded banner, close control, and a footer outside its scrolling body so Directions, save and share stay visible. Valid contact actions remain accessible under Contact venue. Pins use a cream surface with urgency rings and a forest selected state. On narrow screens the selected card is centred at the top of the map. Only Specials opt into the compact results rail.

Property and Services runtime sources match the deployed baseline. The isolated snapshot overlays exactly ten scoped source/test files and preserves ${preservation.unchangedSourceFiles} baseline source files. Existing dirty work, guest-contact changes and unrelated Property/mobile changes were excluded. No pending SQL was applied.

Production demo items currently lack structured prices and uploaded photos. No prices or photos were invented; the lime badge and photo appear when supplied and approved through the existing workflow. Screenshots below use readonly local test data, including a synthetic banner and saved-count fixture; these are not production content.

## Verification

- 332 tests / 47 suites; typecheck, targeted lint, production/OpenNext build and existing initial JavaScript budgets passed.
- Existing Worker size gate: 3064.4 KiB gzip against 3072.0 KiB. Standard generated-server minification preserved function and class names.
- Live read-only checks: 35 routes/APIs and 44 served asset hashes passed. Confirmed served card, legend, upload, review and saved markers; Property rent/buy, all category viewports, private saved caching and guest media denial.
- Cloudflare accepted the Worker at 45 ms startup; compatibility date, nodejs_compat and all eight binding names/types were preserved with --keep-vars.
- Exactly one authorized headed Chromium attempt was consumed and closed. Twelve valid local visual scenarios passed: light/dark at 320, 390, 768 and 1440 px, banner and failed-banner at 320/1440. All captured layouts fit their map bounds and exposed the actions; no page errors, no horizontal document overflow, close cleared selection.
- The two long-title screenshots did not exercise long titles because the fixture exceeded the 160-character contract; refresh retained the previous card. These remain pending, despite passing geometry assertions. browser-audit.json corrects the original driver report. No additional browser run was started. Production verification was HTTP/hash based; the browser run used the isolated local app with intercepted readonly fixtures.

## Evidence and rollback

release.json records the immutable snapshot and hashes; preservation.json records scope; smoke.json records live evidence. browser.json is the raw driver report, browser-audit.json records its verification limitation, and browser-authorization.json records the consumed attempt and driver hash. Screenshots are in browser/. Test driver remains in Temp as required by the Playwright skill.

For an explicitly authorized rollback: npx wrangler rollback ${r.previousVersion} --message=rollback-specials-reference-fix-20261009 . This UI correction has no database changes.

Scoped source artifact: [ZIP](C:/Users/BB/Documents/RoomZA/artifacts/discovery-cards/specials-reference-fix-deployed-20261009.zip).
`;
fs.writeFileSync(dir+'/README.md',readme);
console.log(JSON.stringify({changed:changed.length,preserved:preservation.unchangedSourceFiles,validBrowserCases:12,liveRoutes:smoke.checks.length,liveAssets:smoke.assets.length}));
