import fs from 'node:fs';
const p='docs/cloudflare-deploy-20261008/record-result.mjs';let s=fs.readFileSync(p,'utf8');
s=s.replace('bindingMatch,sourceDrift:drift,','bindingMatch,compatibilityPreserved:JSON.stringify(v.resources.script_runtime.compatibility_flags)===JSON.stringify(before.resources.script_runtime.compatibility_flags)&&v.resources.script_runtime.compatibility_date===before.resources.script_runtime.compatibility_date,sourceDrift:drift,');
s=s.replace('Source and environment files were preserved.','Existing application source and environment files were preserved. package.json and package-lock.json were updated only for the Next.js 16.3.8 security patch and matching lint packages.');
s=s.replace('if(!bindingMatch||drift.length','if(!bindingMatch||!r.result.compatibilityPreserved||drift.length');
fs.writeFileSync(p,s);
