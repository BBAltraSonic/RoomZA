import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const dir='docs/unified-marketplace-release-20261012',r=JSON.parse(fs.readFileSync(dir+'/release.json')),p=JSON.parse(fs.readFileSync('docs/no-email-verification-20261012/release.json'));
let out='';
for(const f of r.scopeFiles.filter(f=>f.startsWith('src/')&&!f.includes('.test.')&&!f.endsWith('/types.ts'))){
 const a=path.join(p.snapshot,f),b=path.join(r.snapshot,f);
 if(!fs.existsSync(a)){out+='\nNEW '+f+'\n'+fs.readFileSync(b,'utf8');continue;}
 try{out+=execFileSync('git',['-c','core.autocrlf=false','diff','--no-index','--',a,b],{encoding:'utf8',maxBuffer:3*1024*1024,stdio:['ignore','pipe','pipe']});}catch(e){if(e.status!==1)throw e;out+=e.stdout;}
}
fs.writeFileSync(dir+'/source-diff.txt',out);console.log(out);
