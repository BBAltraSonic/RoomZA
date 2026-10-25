import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const changed=[...new Set([...execFileSync('git',['diff','--name-only','HEAD','-z'],{encoding:'utf8',windowsHide:true}).split('\0'),...execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true}).split('\0')].filter(Boolean))];
const findings=[];
let scanned=0;
for(const file of changed){if(!fs.existsSync(file)||!fs.statSync(file).isFile()||/\.(png|ico|jpg|jpeg|webp|gz|woff2?)$/i.test(file))continue;const text=fs.readFileSync(file,'utf8');scanned++;
 if(/sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk_live_[A-Za-z0-9]{20,}/.test(text))findings.push({file,kind:'private credential pattern'});
 for(const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){try{const p=JSON.parse(Buffer.from(match[0].split('.')[1],'base64url'));if(p.role==='service_role'&&p.ref==='qleeedwnnfvmfjjymoco')findings.push({file,kind:'production service credential'});}catch{}}
}
const report={checkedAt:new Date().toISOString(),candidateFiles:changed.length,textFilesScanned:scanned,passed:findings.length===0,findings};
fs.writeFileSync('docs/all-work-deploy-20261025/commit-input-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
