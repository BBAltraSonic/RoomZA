import fs from 'node:fs';
const tsconfigSource = fs.readFileSync('tsconfig.json', 'utf8');
const withoutBlock = tsconfigSource.replace(/\/\*[\s\S]*?\*\//g, "");
const withoutLine = withoutBlock.replace(/(?<![:/])\/\/.*$/gm, "");
const withoutTrailingCommas = withoutLine.replace(/,(\s*[}\]])/g, "$1");
console.log(withoutTrailingCommas);
try {
  JSON.parse(withoutTrailingCommas);
  console.log('Success');
} catch (e) {
  console.error(e);
}
