import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/BB/.agents/skills/playwright/node_modules/playwright');
const root=process.cwd(),base='http://127.0.0.1:3098',ledger=path.join(root,'docs/render-race-20261008');
const lock=path.join(ledger,'local-browser-attempt.lock');writeFileSync(lock,new Date().toISOString(),{flag:'wx'});
const evidence=path.join(tmpdir(),'pinpoint-render-browser-'+randomUUID());mkdirSync(evidence);
const result={startedAt:new Date().toISOString(),evidence,driverSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),policy:'One browser launch; zero retries; stop at first failure',conditions:{server:'Isolated Next production build, Windows headed Chromium, loopback; no CPU/network throttling',fixtures:'Synthetic Supabase reads, local generated images and blank map style; no real DB/auth/production credentials',csp:'Only document connect-src relaxed for the two fixture loopback origins. Production headers otherwise retained.',metrics:'Per-navigation lab LCP, CLS (session window), interaction event duration. No field or percentile performance claim.'},cells:[],events:[],failure:null};
const report=path.join(ledger,'browser.json');const save=()=>{writeFileSync(path.join(evidence,'evidence.json'),JSON.stringify(result,null,2));writeFileSync(report,JSON.stringify(result,null,2));};save();
const session=JSON.parse(readFileSync(path.join(ledger,'fixture-session.json'))),area='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const publicRoutes=['/?view=feed','/offers','/services','/auth','/auth/forgot-password','/auth/reset-password','/blog','/trust','/trust/safety','/privacy','/terms','/offers?areaId='+area+'&view=feed','/offers?kind=tourism&areaId='+area+'&view=feed','/offers?kind=event&areaId='+area+'&view=feed','/services?areaId='+area+'&view=feed','/offers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','/specials/dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
publicRoutes.push('/?areaId='+area+'&area=Fixture+place&view=map','/offers?areaId='+area+'&view=map','/offers?kind=tourism&areaId='+area+'&view=map','/offers?kind=event&areaId='+area+'&view=map','/services?areaId='+area+'&view=map');
const protectedRoutes=['/profile','/profile/edit','/profile/documents','/profile/activity','/profile/notifications','/profile/reviews','/profile/verification','/dashboard','/dashboard/applicants','/dashboard/buyers','/dashboard/viewings','/dashboard/imports','/dashboard/organization','/messages','/applications','/saved','/settings','/post/offers','/post/entries','/post/entries/tourism','/post/entries/event','/post/services','/admin','/admin/users','/admin/listings','/admin/offers','/admin/entries','/admin/services','/admin/security','/admin/reports','/admin/operations'];
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#dce9df"/><path d="M140 280V160L300 60L480 160V280" fill="#668673"/><rect x="260" y="200" width="70" height="80" fill="#fbf8ed"/></svg>';
const homeId='ffffffff-ffff-4fff-8fff-ffffffffffff';
const pin={id:homeId,title:'Fixture rental home',area:'Fixture place',price:6500,listingType:'rent',latitude:-33.96,longitude:18.47,bedrooms:2,bathrooms:1,imageUrls:[base+'/render-fixture.svg'],availabilityDate:new Date().toISOString(),created_at:new Date().toISOString(),landlordPresence:'offline'};
const detail={id:homeId,title:pin.title,address:'1 Fixture Street',price:6500,listing_type:'rent',latitude:pin.latitude,longitude:pin.longitude,bedrooms:2,bathrooms:1,parking_type:'none',parking_count:0,electricity_type:'prepaid',water_availability:'municipal',lease_duration:'12_months',availability_date:new Date().toISOString(),created_at:new Date().toISOString(),metadata:null,images:[],landlordPresence:null};
let browser,context,page;let current;let serviceFault=null;const errors=[];
try{
 browser=await chromium.launch({headless:false});context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'no-preference',colorScheme:'light'});
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(()=>{
  window.__renderMetrics={lcp:null,cls:0,sessionValue:0,sessionStart:0,lastShift:0,events:[],longTasks:[],startup:[],unhandled:[]};
  const m=window.__renderMetrics;window.addEventListener('error',e=>m.startup.push({message:e.message,source:e.filename}));window.addEventListener('unhandledrejection',e=>m.unhandled.push(String(e.reason)));
  for(const [type,callback,extra] of [['largest-contentful-paint',entries=>{for(const e of entries)m.lcp=e.startTime;},{}],['layout-shift',entries=>{for(const e of entries){if(e.hadRecentInput)continue;if(e.startTime-m.lastShift>1000||e.startTime-m.sessionStart>5000){m.sessionValue=0;m.sessionStart=e.startTime;}m.sessionValue+=e.value;m.lastShift=e.startTime;m.cls=Math.max(m.cls,m.sessionValue);}},{}],['longtask',entries=>{for(const e of entries)m.longTasks.push({start:e.startTime,duration:e.duration});},{}],['event',entries=>{for(const e of entries)if(e.interactionId)m.events.push({id:e.interactionId,name:e.name,duration:e.duration,start:e.startTime});},{durationThreshold:16}]]){try{new PerformanceObserver(list=>callback(list.getEntries())).observe({type,buffered:true,...extra});}catch{}}
 });
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base){
   if(url.pathname==='/api/services'&&serviceFault==='error'){await route.fulfill({status:503,json:{error:'Intentional local recovery fixture'}});return;}
   if(url.pathname==='/api/services'&&serviceFault==='delay')await new Promise(resolve=>setTimeout(resolve,800));
   if(url.pathname==='/api/listings'){await route.fulfill({json:{ok:true,data:{listings:url.searchParams.get('mode')==='buy'?[]:[pin]}}});return;}
   if(url.pathname==='/api/listings/'+homeId){await route.fulfill({json:{ok:true,data:detail}});return;}
   if(url.pathname.includes('render-fixture.svg')){await route.fulfill({contentType:'image/svg+xml',body:svg,headers:{'cache-control':'public,max-age=86400'}});return;}
   if(request.resourceType()==='document'){
    const response=await route.fetch();const headers=response.headers();if(headers['content-security-policy'])headers['content-security-policy']=headers['content-security-policy'].replace("connect-src 'self'","connect-src 'self' http://127.0.0.1:59991 ws://127.0.0.1:59991");await route.fulfill({response,headers});return;
   }
   // Actions are outside this read-only run; no form submission or enrollment.
   if(request.method()!=='GET'&&request.method()!=='HEAD'){result.events.push({kind:'blocked-local-write',url:url.pathname});await route.fulfill({status:405,json:{error:'Read-only local verification'}});return;}
   await route.continue();return;
  }
  if(url.origin==='http://127.0.0.1:59991'){await route.continue();return;}
  if(url.hostname==='api.maptiler.com'&&url.pathname.endsWith('style.json')){await route.fulfill({json:{version:8,name:'Synthetic local map',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#e3ece5'}}]}});return;}
  result.events.push({kind:'external-blocked',host:url.hostname,path:url.pathname});await route.abort('blockedbyclient');
 });
 page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')result.events.push({kind:'console-error',message:m.text(),cell:current});});
 page.on('requestfailed',r=>result.events.push({kind:'request-failed',url:r.url(),error:r.failure()?.errorText,cell:current}));
 page.on('response',r=>{if(r.request().resourceType()==='script'&&r.status()>=400)errors.push('Script '+r.status()+' '+r.url());});
 let index=0;
 async function visit(route,width,authenticated,reduced=false){
  current={route,width,authenticated,reducedMotion:reduced};console.log('CELL '+JSON.stringify(current));
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference',colorScheme:reduced?'dark':'light'});
  errors.length=0;const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:20000});assert.equal(response?.status(),200,'Route HTTP status');assert.equal(new URL(page.url()).pathname,new URL(base+route).pathname,'Unexpected route redirect');
  await page.locator('[data-motion-route="stable"]').waitFor();
  const discovery=page.locator('[data-slot="pinpoint-header"]');if(await discovery.count())await discovery.first().locator('xpath=self::*[@data-ready="true"]').waitFor({timeout:12000});
  if(new URL(base+route).searchParams.get('view')==='map')await page.locator('canvas').first().waitFor();
  await page.waitForTimeout(350);
  const menu=page.getByRole('button',{name:'Open menu',exact:true});if(await menu.count()){
   await menu.first().click();await page.getByRole('menu',{name:'Account menu'}).waitFor();await page.keyboard.press('Escape');
  }else{await page.keyboard.press('Tab');}
  assert.equal(errors.length,0,'Startup/script errors: '+errors.join(' | '));
  const state=await page.evaluate(()=>{const el=document.querySelector('[data-motion-route]'),style=getComputedStyle(el);return{opacity:style.opacity,visibility:style.visibility,width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,text:el.innerText.trim().length,hydration:window.__renderMetrics.startup,unhandled:window.__renderMetrics.unhandled};});
  assert.equal(state.opacity,'1','Content must remain visible');assert.notEqual(state.visibility,'hidden');assert.ok(state.text>20,'Content text must be present');assert.ok(state.scrollWidth<=width+2,'Horizontal overflow '+state.scrollWidth+' at '+width);assert.deepEqual(state.hydration,[],'Unexplained startup error');assert.deepEqual(state.unhandled,[],'Unhandled rejection');
  const metric=await page.evaluate(()=>window.__renderMetrics);const interaction=metric.events.length?Math.max(...metric.events.map(e=>e.duration)):null;
  const shot=String(++index).padStart(3,'0')+'-'+width+'.png';await page.screenshot({path:path.join(evidence,shot),fullPage:true,timeout:10000});
  const cell={...current,url:page.url(),state,metrics:{lcpMs:metric.lcp,cls:metric.cls,interactionMs:interaction,longTasks:metric.longTasks},screenshot:shot,status:'passed'};result.cells.push(cell);save();
  if((metric.lcp!==null&&metric.lcp>2500)||metric.cls>0.1||(interaction!==null&&interaction>200))cell.status='failed-performance';
  assert.ok(metric.lcp===null||metric.lcp<=2500,'Lab LCP exceeds 2500ms: '+metric.lcp);assert.ok(metric.cls<=0.1,'Lab CLS exceeds 0.1: '+metric.cls);assert.ok(interaction===null||interaction<=200,'Interaction duration exceeds 200ms: '+interaction);
 }
 for(const width of [320,390,768,1024,1440]){await context.clearCookies();for(const route of publicRoutes)await visit(route,width,false);await context.addCookies([{name:session.name,value:session.value,url:base,httpOnly:false,sameSite:'Lax'}]);for(const route of protectedRoutes)await visit(route,width,true);}
 // Intentional reduced-motion cells, followed by a navigation sequence.
 for(const route of ['/?view=feed','/offers?areaId='+area,'/services?areaId='+area,'/profile','/admin'])await visit(route,390,true,true);
 await page.goto(base+'/services?areaId='+area+'&view=feed',{waitUntil:'domcontentloaded'});await page.locator('[data-ready="true"]').waitFor();
 const refine=page.getByRole('button',{name:'Show search, sorting and filters'});if(await refine.count())await refine.click();
 const search=page.getByRole('searchbox');await search.fill('Fixture');
 await page.getByRole('button',{name:'Nearest',exact:true}).click();await page.getByRole('button',{name:'Latest',exact:true}).click();
 assert.equal(new URL(page.url()).searchParams.get('q'),'Fixture');assert.equal(new URL(page.url()).searchParams.get('sort'),'Latest');
 await page.goBack({waitUntil:'domcontentloaded'});assert.equal(new URL(page.url()).searchParams.get('sort'),'Nearest');await page.goForward({waitUntil:'domcontentloaded'});assert.equal(new URL(page.url()).searchParams.get('sort'),'Latest');
 await page.getByRole('button',{name:'Map',exact:true}).click();await page.locator('canvas').first().waitFor();assert.equal(new URL(page.url()).searchParams.get('view'),'map');await page.getByRole('button',{name:'Feed',exact:true}).click();await page.locator('canvas').waitFor({state:'detached'});
 serviceFault='error';
 await page.goto(base+'/services?areaId='+area+'&view=feed',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/retry|try again/i}).waitFor();
 await page.screenshot({path:path.join(evidence,'intentional-error.png'),fullPage:true});
 serviceFault='delay';
 await page.getByRole('button',{name:/retry|try again/i}).click();
 await page.screenshot({path:path.join(evidence,'intentional-loading.png'),fullPage:true});
 await page.getByRole('heading',{name:'Fixture plumbing'}).waitFor();
 serviceFault=null;
 result.recovery={status:'passed',scenario:'Intentional 503 followed by a user recovery action and delayed successful read in the same run'};
 result.navigation={status:'passed',controls:'search, sort, back/forward, Feed/Map; no writes'};result.completedAt=new Date().toISOString();result.status='passed';save();
}catch(error){result.failure={cell:current,message:String(error),stack:error?.stack};result.status='failed-stop-no-retry';result.completedAt=new Date().toISOString();try{if(page)await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true,timeout:5000});}catch{}save();console.log('STOP '+String(error));process.exitCode=1;
}finally{if(context)try{await context.tracing.stop({path:path.join(evidence,'trace.zip')});}catch{}if(browser)await browser.close();save();console.log('Evidence: '+evidence);}
