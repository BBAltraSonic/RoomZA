import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
assert.equal(process.env.PINPOINT_PHASE5_STORAGE_RECOVERY,'1');
const tag=`pinpoint-phase5-storage-${randomUUID()}`,label='pinpoint.phase5.recovery';
const volumes=[`${tag}-source`,`${tag}-restore`],container=`${tag}-helper`,created=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const docker=(args,input,binary=false)=>execFileSync('docker',args,{input,encoding:binary?undefined:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true});
const evidence={tag,environment:'synthetic file-backend Storage byte archive/restore on owned volumes; no shared or remote access',checks:[],passed:false};let helper=false;
try{
 for(const v of volumes){docker(['volume','create','--label',`${label}=${tag}`,v]);created.push(v);}
 docker(['create','--name',container,'--label',`${label}=${tag}`,'--network','none','--read-only','-v',`${volumes[0]}:/source`,'-v',`${volumes[1]}:/restore`,'--entrypoint','sh','public.ecr.aws/supabase/postgres:17.6.1.113','-c','sleep 600']);helper=true;docker(['start',container]);
 assert.equal(JSON.parse(docker(['inspect',container]))[0].HostConfig.NetworkMode,'none');
 const bytes=Buffer.from('%PDF-1.4\nSynthetic Phase 5 Storage restore fixture\n%%EOF\n');
 docker(['exec','-i',container,'sh','-c','mkdir -p /source/private-fixture && cat > /source/private-fixture/document.pdf'],bytes);
 const archive=docker(['exec',container,'tar','-C','/source','-cf','-','.'],undefined,true);
 docker(['exec',container,'rm','/source/private-fixture/document.pdf']);
 docker(['exec','-i',container,'tar','-C','/restore','-xf','-'],archive);
 const restored=docker(['exec',container,'cat','/restore/private-fixture/document.pdf'],undefined,true);
 assert.deepEqual(restored,bytes);
 evidence.archive={bytes:archive.length,sha256:hash(archive),storedOnHost:false};evidence.fixture={path:'private-fixture/document.pdf',bytes:bytes.length,sha256:hash(bytes),restoredSha256:hash(restored)};
 evidence.checks.push({name:'File-backend bytes restored into a different empty owned volume after original deletion',passed:true});evidence.passed=true;
}finally{
 if(helper){assert.equal(JSON.parse(docker(['inspect',container]))[0].Config.Labels[label],tag);docker(['rm','--force',container]);}
 for(const v of created){assert.equal(JSON.parse(docker(['volume','inspect',v]))[0].Labels[label],tag);docker(['volume','rm',v]);}
 evidence.cleanup={ownedContainerRemoved:helper,ownedVolumesRemoved:created};evidence.recordedAt=new Date().toISOString();
 evidence.limitations=['Synthetic file-backend recovery primitive; not target Storage inventory or hosted S3/PITR proof','Database/ACL recovery verified separately; no restored signed-file API journey claimed'];
 writeFileSync('docs/pinpoint-phase5-storage-recovery-2026-10-06.json',JSON.stringify(evidence,null,2)+'\n');
}
assert.ok(evidence.passed);console.log('Storage file-backend recovery passed; owned resources removed');
