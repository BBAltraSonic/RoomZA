import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const protectedSecrets=JSON.parse(fs.readFileSync('.cache/release-secrets-20261013/notification-worker.json','utf8'));
const local=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_0-9]+)=(.*)$/);return m?[[m[1],m[2].replace(/^["']|["']$/g,'')]]:[];}));
const secrets=Object.entries({...local,...protectedSecrets}).filter(([k,v])=>!k.startsWith('NEXT_PUBLIC_')&&k!=='VAPID_PUBLIC_KEY'&&v.length>12);
const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&fs.existsSync(f)&&!(/\.(png|gz|ico|webm|mp4|jpg|jpeg|woff2|pdf)$/.test(f)));
let sanitized=0;
for(const f of files){let value=fs.readFileSync(f,'utf8'),changed=false;for(const [key,secret]of secrets)if(value.includes(secret)){if(!f.startsWith('docs/'))throw Error('Credential in source: '+f);value=value.replaceAll(secret,'[REDACTED:'+key+']');changed=true;}if(changed){fs.writeFileSync(f,value);sanitized++;}}
console.log(JSON.stringify({scanned:files.length,sanitizedEvidenceFiles:sanitized,sourceCredentials:0}));
