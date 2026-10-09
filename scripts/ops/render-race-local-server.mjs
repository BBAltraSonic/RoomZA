import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{WebSocketServer}=require('ws');
const root=process.cwd(),build=JSON.parse(readFileSync('docs/render-race-20261008/build.json'));
const snapshot=build.snapshot.path,logs=path.join(root,'docs/render-race-20261008');
export const userId='11111111-1111-4111-8111-111111111111',areaId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stamp=new Date().toISOString();
const factors=[1,2].map(n=>({id:'fixture-factor-'+n,friendly_name:'Local fixture '+n,factor_type:'totp',status:'verified',created_at:stamp,updated_at:stamp}));
const user={id:userId,aud:'authenticated',role:'authenticated',email:'render-fixture@example.invalid',email_confirmed_at:stamp,created_at:stamp,app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],factors};
const encoded=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const token=encoded({alg:'HS256',typ:'JWT'})+'.'+encoded({aud:'authenticated',sub:userId,role:'authenticated',email:user.email,exp:Math.floor(Date.now()/1000)+86400,iat:Math.floor(Date.now()/1000),aal:'aal2',amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]})+'.fixture-only';
const session={access_token:token,refresh_token:'fixture-inert-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user};
writeFileSync(path.join(logs,'fixture-session.json'),JSON.stringify({name:'sb-127-auth-token',value:'base64-'+encoded(session),userId,scope:'Synthetic local identity. No real authentication/security evidence.'},null,2));
const profile={id:userId,email:user.email,role:'landlord',created_at:stamp,updated_at:stamp,email_verified_at:stamp,full_name:'Render Fixture',phone:null,phone_verified:false,avatar_url:null,about:null,presence_status:'offline',availability_mode:'manual',active_organization_id:null};
const publicProfile={profile_id:userId,username:'render-fixture',display_name:'Render Fixture',avatar_url:null,bio:'Local verification fixture',languages:[],profile_audience:'public',message_audience:'members',phone_audience:'private',email_audience:'private',reviews_visible:true,activity_visible:true,search_indexed:false,joined_at:stamp};
const place={id:areaId,provider_id:'fixture-place',name:'Fixture place',region:'South Africa',full_address:'Fixture place, South Africa',center_lat:-33.96,center_lng:18.47,west:18.4,south:-34,east:18.6,north:-33.9};
const service={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',area_id:areaId,approved_at:stamp,content:{title:'Fixture plumbing',providerName:'Fixture provider',serviceType:'Plumbing',description:'Local synthetic service description',areaId,address:'1 Fixture Street',latitude:-33.96,longitude:18.47,phone:'+27000000000'}};
const start=new Date(Date.now()-3600000).toISOString(),end=new Date(Date.now()+86400000).toISOString();
const offer={offerId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',revisionId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',confirmedAt:stamp,startsAt:start,endsAt:end,areaId,status:'live',content:{title:'Fixture special',benefit:'Fixture benefit',terms:'Fixture terms',shopName:'Fixture shop',address:'1 Fixture Street',areaId,latitude:-33.96,longitude:18.47,startsAt:start,endsAt:end},place:{id:areaId,name:place.name,region:place.region,fullAddress:place.full_address},poster:null};
const entry=category=>({entryId:category==='event'?'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee':'dddddddd-dddd-4ddd-8ddd-dddddddddddd',category,approvedAt:stamp,state:category==='event'?'upcoming':'live',content:{title:category==='event'?'Fixture upcoming event':'Fixture tourism',description:'Local synthetic entry description',venueName:'Fixture venue',areaId,address:'1 Fixture Street',latitude:-33.96,longitude:18.47,startsAt:category==='event'?new Date(Date.now()+3600000).toISOString():start,endsAt:end}});
const tables={profiles:[profile],public_profiles:[publicProfile],profile_personas:['landlord','seller','renter','buyer'].map(persona=>({profile_id:userId,persona,is_active:true,is_primary:persona==='landlord',created_at:stamp})),discovery_places:[place],approved_services:[service],admin_memberships:[{user_id:userId,level:'owner',invited_by:null,created_at:stamp,updated_at:stamp,revoked_at:null}]};
const requests=[];
const backend=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:59991');let body='';for await(const chunk of req)body+=chunk;
 requests.push({time:new Date().toISOString(),method:req.method,path:url.pathname,query:url.search});
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3098');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Expose-Headers','content-range');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}
 let data=[];
 if(url.pathname==='/auth/v1/user')data=user;
 else if(url.pathname==='/auth/v1/admin/users')data={users:[user],aud:'authenticated',total:1};
 else if(url.pathname.startsWith('/rest/v1/rpc/')){
  const rpc=url.pathname.split('/').pop(),args=body?JSON.parse(body):{};
  if(rpc==='pinpoint_offer_public_feed')data={areaId:args.area,serverNow:new Date().toISOString(),totalCount:1,items:[offer],nextCursor:null};
  else if(rpc==='pinpoint_offer_public_count')data={areaId:args.area,serverNow:new Date().toISOString(),totalCount:1};
  else if(rpc==='pinpoint_offer_public_detail')data={...offer,serverNow:new Date().toISOString()};
  else if(rpc==='pinpoint_entry_public_feed')data={category:args.category,areaId:args.area,page:args.page,totalCount:1,items:[entry(args.category)],hasNext:false,serverNow:new Date().toISOString()};
  else if(rpc==='pinpoint_entry_public_detail')data={item:entry(args.target?.startsWith('e')?'event':'tourism'),serverNow:new Date().toISOString()};
  else if(rpc==='touch_presence')data=null;
  else if(!/^(get_|list_|read_|pinpoint_.*(?:feed|detail|count)|search_|can_)/.test(rpc??'')){res.statusCode=405;data={message:'Fixture rejects persisted writes'};}
 } else if(url.pathname.startsWith('/rest/v1/')){
  if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;data={message:'Fixture rejects persisted writes'};}
  else {const name=url.pathname.split('/').pop();data=tables[name]??[];res.setHeader('content-range',data.length?'0-'+(data.length-1)+'/'+data.length:'*/0');if(req.headers.accept?.includes('vnd.pgrst.object'))data=data[0]??null;}
 }
 res.end(req.method==='HEAD'?'':JSON.stringify(data));
});
const ws=new WebSocketServer({noServer:true});backend.on('upgrade',(req,socket,head)=>ws.handleUpgrade(req,socket,head,s=>ws.emit('connection',s,req)));ws.on('connection',socket=>socket.on('message',raw=>{try{const m=JSON.parse(raw);const reply=Array.isArray(m)?[m[0],m[1],m[2],'phx_reply',{status:'ok',response:{postgres_changes:[]}}]:{ref:m.ref,topic:m.topic,event:'phx_reply',payload:{status:'ok',response:{postgres_changes:[]}}};socket.send(JSON.stringify(reply));}catch{}}));
await new Promise((resolve,reject)=>{backend.once('error',reject);backend.listen(59991,'127.0.0.1',resolve);});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA'].includes(k.toUpperCase())));
Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:59991',NEXT_PUBLIC_SUPABASE_ANON_KEY:'render-race-inert-anon',SUPABASE_SERVICE_ROLE_KEY:'render-race-inert-service',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3098',NEXT_PUBLIC_MAPTILER_API_KEY:'render-race-fixture'});
const child=spawn(process.execPath,[path.join(snapshot,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','3098'],{cwd:snapshot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{appendFileSync(path.join(logs,'local-server.log'),b);process.stdout.write(b);});
process.stdin.on('data',()=>{writeFileSync(path.join(logs,'fixture-requests.json'),JSON.stringify(requests,null,2));child.kill();ws.close();backend.close();setTimeout(()=>process.exit(0),1000);});
child.on('exit',code=>{console.log('Next server exit '+code);});
console.log('Synthetic fixture backend ready. No real database or external credentials.');
