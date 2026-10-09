import fs from 'node:fs';
const dir = 'docs/mobile-sheet-deploy-20261008';
let script = fs.readFileSync('docs/shared-cards-deploy-20261008/smoke.mjs', 'utf8');
const start = script.indexOf('const cardMarkers = {');
const end = script.indexOf('const cardBundles = [];', start);
if (start < 0 || end < 0) throw Error('Unexpected smoke script');
script = script.slice(0, start) + `const cardMarkers = {
  sheet: 'mobile-detail-sheet',
  actions: 'Property actions',
  detailScroll: 'listing-detail-scroll-region',
  showingStatus: 'View showing request',
  report: 'group-open:not-sr-only',
};
` + script.slice(end);
script = script.replace("const cardBundles = [];", "const cardBundles = [];\nfor (const file of fs.readdirSync(path.join(release.snapshot, '.open-next/assets/_next/static/css'), {recursive:true}).filter(file=>file.endsWith('.css'))) assetPaths.add('/_next/static/css/'+file.replaceAll('\\\\','/'));");
fs.writeFileSync(dir + '/smoke.mjs', script);
console.log('Prepared live HTTP and changed bundle checks');
