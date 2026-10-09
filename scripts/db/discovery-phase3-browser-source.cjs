// Copied to OS Temp and run by the Playwright skill; no production requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const cfg=JSON.parse(process.env.PINPOINT_BROWSER_CONFIG),checks=[],matrix=[],errors=[],requests=[],diagnostics=[],pending=new Set();
let browser,activePage,passed=false,failure,stage='startup';
const bootstrapResponses=new WeakMap();
async function captureBootstrap(page){
 const state=await page.evaluate(()=>({
  next:window.next,
  flightPush:window.__next_f?.push?.toString(),
  flightSegmentTypes:window.__next_f?.map?.(segment=>segment[0]),
  webpackPush:window.webpackChunk_N_E?.push?.toString(),
  webpackChunks:window.webpackChunk_N_E?.map?.(chunk=>({ids:chunk[0],moduleIds:Object.keys(chunk[1]??{}),hasRuntime:typeof chunk[2]==='function'})),
  beforeInteractive:window.__next_s,
  instantTestFetch:!!window.__next_instant_test,
  clientResumeFetch:!!window.__NEXT_CLIENT_RESUME,
  scripts:[...document.scripts].map(script=>({src:script.src,async:script.async,type:script.type,noModule:script.noModule})),
 }));
 const assets=[];
 assert.match(cfg.attemptId,/^[a-f0-9-]{36}$/);
 for(const response of (bootstrapResponses.get(page)??new Map()).values()){
  const name=new URL(response.url()).pathname.split('/').at(-1);
  const relative=`docs/pinpoint-phase3-${cfg.attemptId}-${name}`;
  try{
   const body=await response.body();
   assert.ok(body.length<=32*1024*1024,'Bootstrap response exceeds capture limit');
   fs.writeFileSync(path.join(cfg.sourceRoot,relative),body);
   assets.push({url:response.url(),status:response.status(),contentType:response.headers()['content-type'],bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex'),path:relative});
  }catch(error){assets.push({url:response.url(),status:response.status(),captureError:error.message});}
 }
 return {state,assets};
}
function progress(){fs.writeFileSync(cfg.resultPath,JSON.stringify({attemptId:cfg.attemptId,passed:false,stage,checks,matrix,errors,diagnostics,recordedAt:new Date().toISOString()},null,2)+'\n');}
function observe(page){
 const responses=new Map();bootstrapResponses.set(page,responses);
 page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())responses.clear();});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')diagnostics.push({type:'console',message:m.text()});});
 page.on('request',r=>{requests.push(r.url());pending.add(r.url());});
 page.on('requestfinished',r=>pending.delete(r.url()));
 page.on('requestfailed',r=>{pending.delete(r.url());diagnostics.push({type:'requestfailed',url:r.url(),failure:r.failure()});});
 page.on('response',r=>{if(/\/_next\/static\/chunks\/(?:webpack|main-app|app-pages-internals)\.js(?:\?|$)/.test(r.url()))responses.set(r.url(),r);if(r.status()>=400)diagnostics.push({type:'http',url:r.url(),status:r.status()});});
}
const definitions=[
 {name:'property',path:'/',api:'/api/listings',add:'Add listing',target:'/dashboard/listings/new'},
 {name:'shopping',path:'/offers',api:'/api/offers',title:'Phase 3 Shopping fixture',id:cfg.fixtureIds.offer,add:'Add special',target:'/post/offers'},
 {name:'tourism',path:'/offers',kind:'tourism',api:'/api/entries',title:'Phase 3 Tourism fixture',id:cfg.fixtureIds.tourism,add:'Add special',target:'/post/entries/tourism'},
 {name:'event',path:'/offers',kind:'event',api:'/api/entries',title:'Phase 3 Event fixture',id:cfg.fixtureIds.event,add:'Add special',target:'/post/entries/event'},
 {name:'services',path:'/services',api:'/api/services',title:'Phase 3 plumbing fixture',id:cfg.fixtureIds.service,add:'Add service',target:'/post/services'},
];
const widths=[1218,1440,768,1024,320,390];
function url(d,view='feed',area=cfg.place,extra={}){return cfg.origin+d.path+'?'+new URLSearchParams({view,areaId:area,area:'Entry fixture area, South Africa',...(d.kind?{kind:d.kind}:{}),...extra});}
async function ready(page){await page.locator('[data-slot="pinpoint-header"][data-ready="true"]').waitFor({timeout:120000});await page.waitForFunction(()=>{const r=document.querySelector('[data-motion-route]');return !r||Number(getComputedStyle(r).opacity)===1});}
async function layout(page){const g=await page.evaluate(()=>{const h=document.querySelector('[data-slot="pinpoint-header"]'),body=document.querySelector('[data-discovery-map-body]');const controls=[...h.querySelectorAll('a,button,input,select')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height);return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,header:h.getBoundingClientRect().toJSON(),body:body?.getBoundingClientRect().toJSON(),outside:controls.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(e=>e.getAttribute('aria-label')||e.textContent),overlaps:controls.flatMap((a,i)=>controls.slice(i+1).filter(b=>!a.contains(b)&&!b.contains(a)&&(()=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2})()).map(b=>[a.getAttribute('aria-label')||a.textContent,b.getAttribute('aria-label')||b.textContent]))};});assert.ok(g.scrollWidth<=g.width+1,JSON.stringify(g));assert.deepEqual(g.outside,[],JSON.stringify(g));assert.deepEqual(g.overlaps,[],JSON.stringify(g));if(g.body){assert.ok(g.body.top>=g.header.bottom-1);assert.ok(g.body.bottom<=g.height+1);}return g;}
 async function init(context){
 await context.route("https://images.unsplash.com/**",r=>r.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#dfe7dc"/></svg>'}));
 await context.route('**/api.maptiler.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({version:8,sources:{},layers:[{id:'fixture-background',type:'background',paint:{'background-color':'#e6eadf'}}]})}));
 await context.route(/\/api\/(?:offers\/)?places\?q=/,async r=>{const a=await context.request.get(cfg.origin+'/api/places/'+cfg.place),b=await context.request.get(cfg.origin+'/api/places/'+cfg.emptyPlace);await r.fulfill({json:{data:{places:[(await a.json()).data.place,(await b.json()).data.place]}}});});
}
async function populated(page,d,view){if(d.title){await page.getByRole('heading',{name:d.title,exact:true}).waitFor();await page.waitForFunction(()=>![...document.querySelectorAll('[role="status"]')].some(e=>/^Checking/.test(e.textContent)));assert.equal(await page.locator('[aria-current="page"] span').first().textContent(),'1');if(view==='map'){await page.locator('.maplibregl-marker').waitFor();assert.equal(await page.locator('.maplibregl-marker').count(),1);const card=page.locator('li#'+(d.name==='services'?'service-':d.kind?'entry-':'special-')+d.id);assert.equal(await card.count(),1);await card.getByRole('button',{name:'Show on map',exact:true}).click();assert.equal(await page.locator('.maplibregl-marker button').getAttribute('aria-pressed'),'true');}}else{if(view==='map'&&page.viewportSize().width<1024){const expand=page.getByRole('button',{name:'Browse listings',exact:true});if(await expand.count())await expand.click();}await page.locator('[data-slot="property-card"]:visible').first().waitFor();}if(view==='feed'){assert.equal(await page.locator('.maplibregl-map').count(),0);assert.equal(await page.locator('[data-slot="category-map"]').count(),0);}assert.equal(await page.getByRole('link',{name:d.add,exact:true}).getAttribute('href'),d.target);}
(async()=>{try{
 browser=await chromium.launch({headless:false,args:['--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:1218,height:900},reducedMotion:'reduce'});await init(context);const page=await context.newPage();activePage=page;page.setDefaultTimeout(60000);observe(page);
 for(const d of definitions)for(const width of widths)for(const view of ['feed','map']){
  stage=`populated ${d.name} ${width} ${view}`;progress();await page.setViewportSize({width,height:width<500?844:900});await page.goto(url(d,view),{waitUntil:'domcontentloaded',timeout:120000});await ready(page);await populated(page,d,view);
  const geometry=await layout(page);matrix.push({category:d.name,width,view,state:'populated',geometry});progress();console.info('CELL '+d.name+' '+width+' '+view);
  if(view==='map'&&(width===320||width===1440))await page.screenshot({path:path.join(cfg.sourceRoot,`docs/pinpoint-phase3-${d.name}-${width}.png`)});
  if(width===320&&d.name!=='property'&&view==='map'){const toggle=page.getByRole('button',{name:/near the map/});await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');}
  if(width===390){await page.getByRole('button',{name:'Show sorting and filters'}).click();await layout(page);await page.getByRole('button',{name:'Show sorting and filters'}).click();}
  if(width===1024){await page.evaluate(()=>document.documentElement.classList.add('dark'));await layout(page);await page.screenshot({path:path.join(cfg.sourceRoot,`docs/pinpoint-phase3-${d.name}-dark.png`)});await page.evaluate(()=>document.documentElement.classList.remove('dark'));}
 }
 checks.push('60 populated category/view/viewport cells, card/pin IDs, counts, creation destinations, mobile disclosures and five dark-theme checks');console.info('PASS '+checks.at(-1));
 stage='response states';progress();for(const d of definitions)for(const view of ['feed','map']){
  await page.setViewportSize({width:390,height:844});await page.goto(url(d,view,cfg.emptyPlace));await ready(page);await page.waitForFunction(()=>![...document.querySelectorAll('[role="status"]')].some(e=>/Checking|Loading|Updating/.test(e.textContent)));assert.equal(await page.locator('.maplibregl-marker').count(),0);if(d.title)assert.equal(await page.getByRole('heading',{name:d.title,exact:true}).count(),0);await layout(page);matrix.push({category:d.name,view,state:'empty'});
  await page.goto(url(d,view,'bad-id'));await ready(page);await page.waitForFunction(()=>/unavailable|could not be loaded|Choose a location/i.test(document.body.innerText));assert.equal(await page.locator('.maplibregl-marker').count(),0);matrix.push({category:d.name,view,state:'unavailable'});
  const pattern=new RegExp(d.api.replaceAll('/','\\/')+'\\?');await page.route(pattern,r=>r.fulfill({status:503,json:{error:'Controlled Phase 3 failure'}}));await page.goto(url(d,view));await ready(page);await page.getByRole('alert').filter({hasText:/load|check|unavailable|fetch/i}).first().waitFor();assert.equal(await page.locator('.maplibregl-marker').count(),0);if(d.title)assert.equal(await page.getByRole('heading',{name:d.title,exact:true}).count(),0);await layout(page);matrix.push({category:d.name,view,state:'failure'});await page.unroute(pattern);const retry=page.getByRole('button',{name:/Refresh (offers|specials|services)|Try again|Retry/i}).first();await retry.click();await populated(page,d,view);checks.push(d.name+' '+view+' empty/unavailable/failure/retry');
 }
 console.info('PASS response-state and recovery matrix');
 stage='URL controls';progress();for(const d of definitions.filter(d=>d.title)){
  await page.setViewportSize({width:1440,height:900});await page.goto(url(d,'feed'));await ready(page);await populated(page,d,'feed');
  const input=page.getByRole('searchbox',{name:/Search (specials|services)/});await input.fill('no-match-phase3');await page.getByText(/No (specials|services) match/).waitFor();assert.ok(new URL(page.url()).searchParams.get('q')==='no-match-phase3','Search missing from URL');await input.fill('fixture');await page.getByRole('button',{name:'Nearest',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('sort'),'Nearest');if(d.name==='services')await page.getByRole('combobox',{name:'Service type'}).selectOption('Plumbing');await page.getByRole('button',{name:'Map',exact:true}).click();await ready(page);await populated(page,d,'map');assert.equal(await input.inputValue(),'fixture');assert.equal(await page.getByRole('button',{name:'Nearest',exact:true}).getAttribute('aria-pressed'),'true');await page.reload();await ready(page);await populated(page,d,'map');assert.equal(await input.inputValue(),'fixture');await page.goBack();await ready(page);assert.equal(new URL(page.url()).searchParams.get('view'),'feed');await page.goForward();await ready(page);assert.equal(new URL(page.url()).searchParams.get('view'),'map');checks.push(d.name+' URL search/sort/filter reload and Map/Feed back/forward');
 }
 // Category navigation carries only the place and view, never a stale category-specific filter.
 await page.goto(url(definitions[2],'feed'));await ready(page);for(const name of ['Services','Property','Specials']){await page.getByRole('navigation',{name:'Discovery categories'}).getByRole('link',{name:new RegExp('^'+name)}).click();await ready(page);assert.equal(new URL(page.url()).searchParams.get('areaId'),cfg.place);assert.equal(new URL(page.url()).searchParams.get('view'),'feed');}checks.push('Cross-category links preserve stored app-owned place and Feed');
 // Each fresh Feed context must avoid map code as well as map DOM.
 for(const d of definitions){const fresh=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});await init(fresh);const p=await fresh.newPage(),scripts=[];p.on('response',r=>{if(/\.js(?:\?|$)/.test(r.url()))scripts.push(r)});await p.goto(url(d,'feed'));await ready(p);await populated(p,d,'feed');const code=await Promise.all(scripts.map(r=>r.text().catch(()=>'')));assert.ok(!code.some(t=>t.includes('node_modules/maplibre-gl/dist/maplibre-gl.js')),'MapLibre implementation loaded in fresh Feed '+d.name);await fresh.close();}checks.push('Five fresh Feed contexts load no MapLibre implementation or worker');
 // Location keyboard selection, duplicate labels and late requests, on each category.
 for(const d of definitions){await page.goto(url(d,'feed'));await ready(page);await populated(page,d,'feed');const trigger=page.getByRole('button',{name:/^Location:/});await trigger.focus();await page.keyboard.press('Enter');const combo=page.getByRole('combobox',{name:'Search South African locations'});await combo.fill('Entry');await page.getByRole('option').nth(1).waitFor();assert.equal(await page.getByRole('option').count(),2);await combo.press('ArrowDown');await combo.press('ArrowDown');await combo.press('Enter');await page.waitForURL(u=>u.searchParams.get('areaId')===cfg.emptyPlace);await ready(page);assert.equal(await page.getByRole('button',{name:/^Location:/}).evaluate(e=>e===document.activeElement),true);await layout(page);await trigger.click();await combo.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');checks.push(d.name+' duplicate-label keyboard selection uses distinct UUID and restores focus');}
 // Deliver the previous area's response after a client-side place change.
 for(const d of definitions){
  let release,started;const gate=new Promise(r=>release=r),seen=new Promise(r=>started=r);
  const pattern=new RegExp(d.api.replaceAll('/','\\/')+'\\?');
  await page.route(pattern,async route=>{if(new URL(route.request().url()).searchParams.get('areaId')!==cfg.place)return route.continue();const response=await route.fetch();started();await gate;await route.fulfill({response}).catch(()=>{});});
  await page.goto(url(d,'feed'));await ready(page);await seen;
  await page.getByRole('button',{name:/^Location:/}).click();const combo=page.getByRole('combobox',{name:'Search South African locations'});await combo.fill('Entry');await page.getByRole('option').nth(1).waitFor();await combo.press('ArrowDown');await combo.press('ArrowDown');await combo.press('Enter');await page.waitForURL(u=>u.searchParams.get('areaId')===cfg.emptyPlace);release();await ready(page);
  await page.waitForFunction(()=>![...document.querySelectorAll('[role="status"]')].some(e=>/Checking|Loading|Updating/.test(e.textContent)));assert.equal(await page.locator('.maplibregl-marker').count(),0);if(d.title)assert.equal(await page.getByRole('heading',{name:d.title,exact:true}).count(),0);await page.unroute(pattern);checks.push(d.name+' aborted late previous-area response cannot restore cards/pins');
 }

 stage='Property sheets';progress();
 // Native Property full sheets, detail IDs/direct URLs, rent/buy and saved-home links.
 for(const width of [320,390,768,1024,1218,1440]){
  const d=definitions[0];await page.setViewportSize({width,height:900});await page.goto(url(d,'map'));await ready(page);await populated(page,d,'map');
  if(width<1024){const full=page.getByRole('button',{name:'Open full listings list',exact:true});if(await full.count())await full.click();await page.getByRole('button',{name:'Show map',exact:true}).waitFor();await layout(page);}
  const card=page.locator('[data-slot="property-card"]:visible').first();const activate=card.getByRole('button',{name:/View details for/});await activate.click();await page.waitForURL(u=>u.searchParams.has('listingId'));const listingId=new URL(page.url()).searchParams.get('listingId');await page.getByRole('heading',{level:1}).filter({hasNotText:'Homes in view'}).first().waitFor();await layout(page);await page.screenshot({path:path.join(cfg.sourceRoot,'docs/pinpoint-phase3-property-detail-'+width+'.png')});await page.reload();await ready(page);assert.equal(new URL(page.url()).searchParams.get('listingId'),listingId);await page.getByRole('button',{name:'Back to homes',exact:true}).filter({visible:true}).first().click();
  const disclosure=page.getByRole('button',{name:'Show sorting and filters'});if(width<1024){await disclosure.waitFor({state:'visible'});if(await disclosure.getAttribute('aria-expanded')!=='true')await disclosure.click();assert.equal(await disclosure.getAttribute('aria-expanded'),'true');}else{assert.equal(await disclosure.isVisible(),false);}await page.getByRole('button',{name:'Buy',exact:true}).filter({visible:true}).first().click();await page.waitForURL(u=>u.searchParams.get('mode')==='buy');await page.getByRole('button',{name:'Rent',exact:true}).filter({visible:true}).first().click();await page.waitForURL(u=>u.searchParams.get('mode')!=='buy');checks.push('Property '+width+' full/detail sheet, reload ID and rent/buy navigation');
 }
 for(const d of definitions){await page.setViewportSize({width:1440,height:900});await page.goto(url(d,'feed',cfg.place,{q:'fixture',sort:d.name==='property'?'Latest':'Nearest'}));await ready(page);const returnPath=new URL(page.url()).pathname+new URL(page.url()).search;await page.getByRole('button',{name:'Open menu',exact:true}).click();const signIn=page.getByRole('menuitem',{name:'Sign in or create account'});assert.equal(new URL(await signIn.getAttribute('href'),cfg.origin).searchParams.get('redirect'),returnPath);await signIn.click();await page.waitForURL(u=>u.pathname==='/auth');assert.equal(new URL(page.url()).searchParams.get('redirect'),returnPath);assert.equal(await page.locator('input[name="redirect"]').inputValue(),returnPath);checks.push(d.name+' sign-in preserves exact discovery return path');}
 
 stage='genuine login return';progress();
 for(const destination of [...definitions.map(d=>url(d,'feed',cfg.place,{sort:d.name==='property'?'Latest':'Nearest'})),cfg.origin+'/specials/'+cfg.fixtureIds.tourism,cfg.origin+'/specials/'+cfg.fixtureIds.event,cfg.origin+'/post/services']){
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await init(c);const p=await c.newPage();activePage=p;observe(p);
  const target=new URL(destination),returnPath=target.pathname+target.search;
  await p.goto(cfg.origin+'/auth?redirect='+encodeURIComponent(returnPath));await p.locator('input[name="email"]').fill(cfg.login.email);await p.locator('input[name="password"]').fill(cfg.login.password);await p.locator('button[type="submit"]').click();await p.waitForURL(u=>u.pathname+u.search===returnPath,{timeout:120000});
  if(target.pathname==='/specials/'+cfg.fixtureIds.tourism||target.pathname==='/specials/'+cfg.fixtureIds.event)await p.getByRole('heading',{level:1}).waitFor();else if(target.pathname==='/post/services')await p.getByRole('heading',{name:'Your services',exact:true}).waitFor();else await ready(p);
  await p.reload();assert.equal(new URL(p.url()).pathname+new URL(p.url()).search,returnPath);
  if(target.pathname==='/'){
   await ready(p);await populated(p,definitions[0],'feed');const card=p.locator('[data-slot="property-card"]:visible').first();const title=await card.getByRole('heading').textContent();const saving=p.waitForResponse(r=>r.url().includes('/api/favorites')&&r.request().method()==='POST');await card.getByRole('button',{name:'Save listing',exact:true}).click();assert.equal((await saving).status(),200);await card.getByRole('button',{name:'Remove from saved',exact:true}).waitFor();await p.getByRole('link',{name:'Saved homes',exact:true}).click();await p.getByRole('heading',{name:title.trim(),exact:true}).waitFor();const href=await p.getByRole('link',{name:'View details for '+title.trim(),exact:true}).getAttribute('href');const id=new URL(href,cfg.origin).searchParams.get('listingId')??href.split('/').at(-1);assert.ok(id);await p.reload();await p.getByRole('heading',{name:title.trim(),exact:true}).waitFor();await p.getByRole('link',{name:'View details for '+title.trim(),exact:true}).click();assert.ok(p.url().includes(id));await p.goto(cfg.origin+'/saved');await p.getByRole('button',{name:'Remove from saved',exact:true}).click();await p.getByText(/removed all your saved homes/).waitFor();await p.reload();await p.getByRole('heading',{name:'Save your first home',exact:true}).waitFor();checks.push('Genuine renter saved-home save/reload/original listing ID/detail link/remove/reload');
  }
  await c.close();activePage=page;checks.push('Genuine password sign-in and cookie reload return to '+returnPath);progress();
 }
 const poster=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await init(poster);const pp=await poster.newPage();activePage=pp;observe(pp);await pp.goto(cfg.origin+'/auth?redirect=%2Fpost%2Fservices');await pp.locator('input[name="email"]').fill(cfg.posterLogin.email);await pp.locator('input[name="password"]').fill(cfg.posterLogin.password);await pp.locator('button[type="submit"]').click();await pp.waitForURL(u=>u.pathname==='/post/services',{timeout:120000});await pp.getByRole('heading',{name:'Your services',exact:true}).waitFor();await poster.close();activePage=page;checks.push('Poster without Property persona returns to Services workspace after genuine login');
 assert.deepEqual(errors,[]);passed=true;
}catch(e){failure={message:e.message,stack:e.stack,url:activePage?.url(),stage,pending:[...pending],browserState:activePage?await activePage.evaluate(()=>({readyState:document.readyState,resources:performance.getEntriesByType('resource').map(r=>r.name),flight:window.__next_f?.length,webpack:window.webpackChunk_N_E?.length,header:document.querySelector('[data-slot="pinpoint-header"]')?.outerHTML,route:document.querySelector('[data-motion-route]')?.outerHTML.slice(0,1500)})):undefined,html:activePage?await activePage.content():undefined,body:activePage?await activePage.locator("body").innerText():undefined};if(activePage)failure.bootstrap=await captureBootstrap(activePage).catch(error=>({captureError:error.message}));if(activePage)await activePage.screenshot({path:path.join(cfg.sourceRoot,"docs/pinpoint-phase3-browser-failure.png")}).catch(()=>{});console.error({message:failure.message,stage:failure.stage,url:failure.url});}finally{if(browser){for(const c of browser.contexts())await c.unrouteAll({behavior:"ignoreErrors"});await browser.close();}fs.writeFileSync(cfg.resultPath,JSON.stringify({attemptId:cfg.attemptId,stage,passed,checks,matrix,errors,diagnostics,failure,requests:requests.filter(u=>/api\/|maplibre/.test(u)),substitutions:['blank MapTiler style','place suggestions from genuine stored clone UUIDs','controlled 503 response failures','synthetic image placeholder for existing external seed photos'],recordedAt:new Date().toISOString()},null,2)+'\n');}assert.ok(passed);
})();
