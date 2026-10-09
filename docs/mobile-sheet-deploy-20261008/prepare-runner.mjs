import fs from 'node:fs';
const output = 'docs/mobile-sheet-deploy-20261008';
fs.mkdirSync(output, { recursive: true });
let script = fs.readFileSync('artifacts/discovery-viewport-20261008/prepare-release.mjs', 'utf8');
script = script.replaceAll("artifacts/discovery-viewport-20261008", output)
  .replaceAll('docs/discovery-location-deploy-20261008/release.json', 'artifacts/discovery-viewport-20261008/release.json')
  .replace('pinpoint-viewport-release-', 'pinpoint-mobile-sheet-release-')
  .replace('Prepared isolated viewport release:', 'Prepared isolated mobile sheet release:');
const start = script.indexOf('const changed=[');
const end = script.indexOf('const manifestPath=', start);
if (start < 0 || end < 0) throw Error('Unexpected preparation script');
script = script.slice(0, start) + `const changed=[
  'src/features/admin/components/report-panel.tsx',
  'src/features/map-discovery/discovery-page.tsx',
  'src/features/map-discovery/listing-detail-panel.tsx',
  'src/features/showings/connect-now-sheet.tsx',
];
const added=[];
` + script.slice(end);
const testLine = script.split('\n').find(line => line.includes("await run('tests',"));
if (!testLine) throw Error('Test command missing');
script = script.replace(testLine, "  await run('tests','npx vitest run src/features/map-discovery/listing-detail-panel.share.test.tsx src/features/map-discovery/discovery-page.detail-expansion.test.tsx src/features/map-discovery/discovery-page.detail-loader.test.tsx src/features/map-discovery/discovery-page.sheet-persistence.test.tsx src/features/admin/components/report-panel.test.tsx src/features/applications/application-modal.test.tsx --maxWorkers=1');")
  .replace("await run('lint','npm run lint');", "await run('lint','npx eslint src/features/map-discovery/discovery-page.tsx src/features/map-discovery/listing-detail-panel.tsx src/features/showings/connect-now-sheet.tsx src/features/admin/components/report-panel.tsx');");
fs.writeFileSync(output + '/prepare-release.mjs', script);
let deploy = fs.readFileSync('artifacts/discovery-viewport-20261008/deploy-authorized.mjs', 'utf8')
  .replaceAll('artifacts/discovery-viewport-20261008', output)
  .replace('--message=discovery-viewport-20261008', '--message=mobile-property-sheet-20261008')
  .replace('r.hostedDatabaseChanges=true;', 'r.hostedDatabaseChanges=false;');
fs.writeFileSync(output + '/deploy-authorized.mjs', deploy);
console.log('Prepared release tooling');
