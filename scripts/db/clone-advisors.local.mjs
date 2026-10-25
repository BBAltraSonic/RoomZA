/** Read-only Supabase advisors through a temporary, loopback-only clone bridge. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

export async function runCloneAdvisors(cfg, outputPath) {
  assert.equal(cfg.supabaseUrl,"http://127.0.0.1:55431");
  assert.match(cfg.dbName,/^pinpoint-release-[0-9a-f-]{36}-db$/);
  const tag=cfg.dbName.slice(0,-3),authName=tag+"-auth";
  for(const name of [cfg.dbName,authName]){
    const info=JSON.parse(execFileSync("docker",["inspect",name],{encoding:"utf8"}))[0];
    assert.equal(info.Config.Labels["pinpoint.release.run"],tag);
  }
  const cli=path.join(cfg.sourceRoot,"node_modules/supabase/dist/supabase.js");
  assert.ok(existsSync(cli),"Installed Supabase CLI is required for clone advisors");
  assert.ok(path.resolve(outputPath).startsWith(path.resolve(cfg.sourceRoot,"artifacts")+path.sep));
  const sockets=new Set(),bridges=new Set();
  const server=createServer(socket=>{
    const bridge=spawn("docker",["exec","-i",authName,"nc",cfg.dbName,"5432"],{stdio:["pipe","pipe","pipe"],windowsHide:true});
    sockets.add(socket);bridges.add(bridge);
    socket.on("error",()=>socket.destroy());bridge.stdin.on("error",()=>socket.destroy());bridge.stdout.on("error",()=>socket.destroy());bridge.stderr.resume();
    socket.once("close",()=>{sockets.delete(socket);bridge.kill();});
    bridge.once("exit",()=>{bridges.delete(bridge);socket.destroy();});
    socket.pipe(bridge.stdin);bridge.stdout.pipe(socket);
  });
  let child,timer;
  try{
    await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
    const address=server.address();assert.ok(address&&typeof address!=="string");
    const url=`postgresql://supabase_admin:${encodeURIComponent(cfg.dbPassword)}@127.0.0.1:${address.port}/postgres?sslmode=disable`;
    const result=await new Promise((resolve,reject)=>{
      child=spawn(process.execPath,[cli,"db","advisors","--db-url",url,"--type","all","--output-format","json","--fail-on","none"],{cwd:cfg.sourceRoot,env:{...process.env,DO_NOT_TRACK:"1",CI:"1",SUPABASE_TELEMETRY_DISABLED:"true"},stdio:["ignore","pipe","pipe"],windowsHide:true});
      let stdout="",stderr="";
      child.stdout.on("data",data=>{stdout+=data;if(stdout.length>16*1024*1024){child.kill();reject(new Error("Clone advisor output exceeded limit"));}});
      child.stderr.on("data",data=>{stderr+=data;if(stderr.length>1024*1024)stderr=stderr.slice(-1024*1024);});
      child.once("error",()=>reject(new Error("Clone advisor process could not start; connection arguments withheld")));
      child.once("exit",code=>resolve({code,stdout,stderr}));
      timer=setTimeout(()=>{child.kill();reject(new Error("Clone advisor process exceeded 60 seconds; connection arguments withheld"));},60000);
    });
    const redact=value=>value.replaceAll(cfg.dbPassword,"[clone-password-withheld]").replaceAll(encodeURIComponent(cfg.dbPassword),"[clone-password-withheld]");
    const report={passed:result.code===0,exitCode:result.code,scope:"Read-only advisors on labelled clone through an ephemeral loopback bridge; no remote or shared database access",target:{host:"127.0.0.1",databaseContainer:cfg.dbName,bridgeContainer:authName},stdout:redact(result.stdout),stderr:redact(result.stderr)};
    writeFileSync(outputPath,JSON.stringify(report,null,2)+"\n");
    return report;
  }finally{
    clearTimeout(timer);if(child&&child.exitCode===null)child.kill();
    for(const socket of sockets)socket.destroy();for(const bridge of bridges)bridge.kill();
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
}
