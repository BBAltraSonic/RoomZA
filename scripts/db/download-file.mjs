// Resumable range download for large public source files. Each completed chunk
// is cached; validate Content-Range and final size before exposing the result.
import { open, mkdir, readFile, writeFile, stat, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function downloadFile(url, output, { chunkSize=4*1024*1024, concurrency=4 }={}) {
  const head=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(30000)});
  if(!head.ok)throw new Error(`Source headers failed: ${head.status}`);
  const length=Number(head.headers.get('content-length')),resolved=head.url;
  await mkdir(path.dirname(output),{recursive:true});
  if(!Number.isSafeInteger(length)||length<=0||!head.headers.get('accept-ranges')?.includes('bytes')) {
    const response=await fetch(resolved,{signal:AbortSignal.timeout(600000)});
    if(!response.ok)throw new Error(`Download failed: ${response.status}`);
    await pipeline(Readable.fromWeb(response.body),createWriteStream(output+'.partial'));
    await rename(output+'.partial',output);return {resolved_url:resolved,bytes:(await stat(output)).size};
  }
  const parts=output+'.parts';await mkdir(parts,{recursive:true});
  const identity=JSON.stringify({url:resolved,length,etag:head.headers.get('etag'),chunkSize});
  try {if(await readFile(path.join(parts,'source.json'),'utf8')!==identity)throw new Error('Source changed; use a new output path');}
  catch(error){if(error.code!=='ENOENT')throw error;await writeFile(path.join(parts,'source.json'),identity);}
  const count=Math.ceil(length/chunkSize);let next=0,completed=0;
  await Promise.all(Array.from({length:concurrency},async()=>{
    while(next<count){const i=next++,start=i*chunkSize,end=Math.min(length-1,start+chunkSize-1),file=path.join(parts,String(i));
      try{if((await stat(file)).size===end-start+1){completed++;continue;}}catch{}
      for(let attempt=0;;attempt++){
        try{const response=await fetch(resolved,{headers:{Range:`bytes=${start}-${end}`},signal:AbortSignal.timeout(120000)});
          if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${length}`)throw new Error('Invalid source range response');
          const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==end-start+1)throw new Error('Truncated source chunk');
          await writeFile(file,bytes);break;
        }catch(error){if(attempt>=2)throw error;}
      }
      completed++;if(completed%10===0||completed===count)console.log(`Source chunks: ${completed}/${count}`);
    }
  }));
  const handle=await open(output+'.partial','w');
  try{for(let i=0;i<count;i++){const bytes=await readFile(path.join(parts,String(i)));await handle.write(bytes,0,bytes.length,i*chunkSize);}}finally{await handle.close();}
  if((await stat(output+'.partial')).size!==length)throw new Error('Wrong assembled source size');
  await rename(output+'.partial',output);return {resolved_url:resolved,bytes:length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))downloadFile(process.argv[2],process.argv[3]).then(console.log).catch(e=>{console.error(e.message);process.exitCode=1;});
