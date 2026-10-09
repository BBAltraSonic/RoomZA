import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const dir='docs/cloudflare-deploy-20261008/',p=dir+'release.json',r=JSON.parse(fs.readFileSync(p));
const audit=fs.readFileSync(dir+'patch-audit.log','utf8');if(!audit.includes('found 0 vulnerabilities'))throw Error('Patch audit not clean');
const hash=b=>createHash('sha256').update(b).digest('hex');
r.prePatchChecks=r.checks;r.checks=[];
for(const c of r.prePatchChecks)if(fs.existsSync(dir+c.name+'.log'))fs.renameSync(dir+c.name+'.log',dir+c.name+'-before-patch.log');
for(const f of ['package.json','package-lock.json']){if(hash(fs.readFileSync(f))!==r.sourceHashes[f])throw Error('Manifest drift: '+f);fs.copyFileSync(path.join(r.snapshot,f),f);r.sourceHashes[f]=hash(fs.readFileSync(f));}
r.securityPatch={next:'16.3.8',eslintConfigNext:'16.3.8',auditPassed:true};fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n');console.log(audit.trim());
