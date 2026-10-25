import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PINPOINT_KIT_PORT||8766);
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.json':'application/json','.md':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(target.includes(`${path.sep}node_modules${path.sep}`)||target.includes(`${path.sep}.build${path.sep}`)){res.writeHead(403).end();return;}
    const data=await fs.readFile(target);
    const headers={'Content-Type':mime[path.extname(target)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
    const range=/^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range||''));
    if(range){
      const start=range[1]?Number(range[1]):Math.max(0,data.length-Number(range[2]));
      const end=range[1]&&range[2]?Math.min(data.length-1,Number(range[2])):data.length-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=data.length){res.writeHead(416,{'Content-Range':`bytes */${data.length}`}).end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1}).end(req.method==='HEAD'?undefined:data.subarray(start,end+1));
    }else res.writeHead(200,{...headers,'Content-Length':data.length}).end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Pinpoint launch kit: http://127.0.0.1:${port}`));
