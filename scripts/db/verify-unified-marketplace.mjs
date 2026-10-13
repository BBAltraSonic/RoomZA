// Runs only inside the disposable clone runner. Never connects to hosted/shared data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const config = JSON.parse(process.env.PINPOINT_CLONE_CONFIG ?? '{}');
assert.equal(config.supabaseUrl, 'http://127.0.0.1:55431');
assert.match(config.dbName, /^pinpoint-release-[a-f0-9-]+-db$/);
const checks = [], accounts = [];
let browser, server, passed = false;
const sql = query => {
  try { return execFileSync('docker', ['exec','-i','-e','PGPASSWORD='+config.dbPassword,config.dbName,'psql','-X','-h','127.0.0.1','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'], {input: query, encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim(); }
  catch(error) { throw new Error('Clone SQL check failed: '+(String(error.stderr ?? '').match(/ERROR:[^\r\n]*/)?.[0] ?? 'details withheld')); }
};
const sdk = key => createClient(config.supabaseUrl,key,{ auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false } });
const admin=sdk(config.serviceKey), guest=sdk(config.anonKey);
function ok(result, label) { assert.equal(result.error, null, label+': '+result.error?.message); return result.data; }
function check(label, condition=true) { assert.ok(condition,label);checks.push(label);console.info('PASS',label); }
const password='Fixture!'+randomUUID();
async function account(label) {
  const email=label+'-'+randomUUID()+'@example.test';
  const {user}=ok(await admin.auth.admin.createUser({email,password,email_confirm:true}), 'create fixture');
  accounts.push(user.id);
  sql("insert into public.policy_acceptances(user_id,document_id,version_id,source) select '"+user.id+"',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing; update public.notification_subscriptions set enabled=false,frequency='never' where user_id='"+user.id+"' and channel='email'");
  const client=sdk(config.anonKey);const {session}=ok(await client.auth.signInWithPassword({email,password}), 'fixture sign-in');
  return {id:user.id,email,client,session};
}
const count = (table, where) => Number(sql('select count(*) from public.'+table+' where '+where));
const app='http://localhost:3112';
try {
  const consumer=await account('consumer'), provider=await account('provider'), other=await account('other');
  check('new accounts initialize every ordinary workflow',count('profile_personas',"profile_id='"+other.id+"'")===4);
  for (const [actor,persona] of [[consumer,'renter'],[provider,'seller']]) {
    sql("delete from public.profile_personas where profile_id='"+actor.id+"' and persona<>'"+persona+"'; update public.profile_personas set is_primary=true,is_active=true where profile_id='"+actor.id+"'; update public.renter_profile_details set occupation='Preserve me' where profile_id='"+actor.id+"';");
    ok(await actor.client.rpc('ensure_marketplace_account'), 'enable ordinary capabilities');
    const personas=ok(await actor.client.from('profile_personas').select('persona,is_primary,is_active').eq('profile_id',actor.id),'read personas');
    check(persona+' account gains all four workflows',personas.length===4);
    check(persona+' primary and active selections remain',personas.find(p=>p.persona===persona).is_active && personas.find(p=>p.persona===persona).is_primary);
    check(persona+' saved details remain',sql("select occupation from public.renter_profile_details where profile_id='"+actor.id+"'")==='Preserve me');
    ok(await actor.client.rpc('ensure_marketplace_account'),'repeat setup');
    check(persona+' setup is idempotent',count('profile_personas',"profile_id='"+actor.id+"'")===4);
  }
  check('guests cannot enroll',!!(await guest.rpc('ensure_marketplace_account')).error);
  const initialMemberships=count('admin_memberships','true');
  ok(await consumer.client.rpc('ensure_marketplace_account'),'self-only setup');
  check('ordinary enrollment creates no admin membership',count('admin_memberships','true')===initialMemberships);
  const listingIds=[];
  for (const type of ['rent','sale']) {
    const target=randomUUID();
    const payload={listing_type:type,title:'Shared account '+type,property_type:'apartment',price:12000,sale_price:type==='sale'?1200000:null,address:'Fixture address, Cape Town',latitude:-33.9249,longitude:18.4241};
    const claims=JSON.parse(Buffer.from(consumer.session.access_token.split('.')[1],'base64url'));
    const args={actor_id:consumer.id,actor_session_id:claims.session_id,target,payload};
    check('ordinary JWT cannot call trusted draft primitive',!!(await consumer.client.rpc('pinpoint_property_create_draft',args)).error);
    const result=ok(await admin.rpc('pinpoint_property_create_draft',args),'trusted property draft');
    check('former consumer can create '+type+' property',result.listingId===target);listingIds.push(target);
    ok(await admin.rpc('pinpoint_property_create_draft',args),'retry property draft');
    check(type+' draft retry is idempotent',count('listings',"id='"+target+"'")===1);
  }
  const owned=ok(await other.client.from('listings').select('id').in('id',listingIds),'other account visibility');
  check('another account cannot read private property drafts',owned.length===0);
  const writes=await other.client.from('listings').update({title:'Unauthorized'}).eq('id',listingIds[0]).select('id');
  check('another account cannot edit property drafts',writes.error?.code==='42501'||writes.data?.length===0);
  const published=randomUUID();
  sql("insert into public.listings(id,landlord_id,title,property_type,price,address,latitude,longitude,status,metadata) values ('"+published+"','"+other.id+"','Consumer fixture','apartment',12000,'Fixture address',-33.9249,18.4241,'published','{\"publicContact\":{\"phone\":\"+27215550100\"},\"contactConsent\":true}'::jsonb)");
  ok(await provider.client.from('user_favorites').insert({user_id:provider.id,listing_id:published}), 'provider saves property');
  check('former provider can save a home',count('user_favorites',"user_id='"+provider.id+"'")===1);
  const crossSave=await other.client.from('user_favorites').insert({user_id:provider.id,listing_id:listingIds[0]});
  check('saved homes remain owner-scoped',!!crossSave.error);
  const inquiry=ok(await provider.client.from('conversations').insert({listing_id:published,renter_id:provider.id,landlord_id:other.id,type:'inquiry'}).select('id').single(),'provider enquires');
  check('former provider can enquire about another home',!!inquiry.id);
  const organization=ok(await provider.client.rpc('create_organization',{organization_name:'Fixture organization',organization_slug:'fixture-'+randomUUID()}),'create own organization');
  check('shared account can create its own organization',!!organization);
  check('organization creation grants only its own owner membership',count('organization_memberships',"organization_id='"+organization+"' and user_id='"+provider.id+"' and role='owner'")===1);
  const beforeInvites=count('organization_memberships','true');
  check('shared account cannot accept an invalid organization invitation',!!(await other.client.rpc('accept_organization_invitation',{invitation_token_hash:'invalid-fixture-token'})).error);
  check('invalid invitation creates no membership',count('organization_memberships','true')===beforeInvites);
  sql("insert into public.account_suspensions(user_id,reason,suspended_by) values ('"+consumer.id+"','Fixture suspension','"+other.id+"')");
  check('suspended account cannot retry capability setup',!!(await consumer.client.rpc('ensure_marketplace_account')).error);
  sql("delete from public.account_suspensions where user_id='"+consumer.id+"'");
  // The running app uses only this contained clone and synthetic identities.
  const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.supabaseUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.anonKey,SUPABASE_SERVICE_ROLE_KEY:config.serviceKey,NEXT_PUBLIC_TURNSTILE_SITE_KEY:'',TURNSTILE_SECRET_KEY:'',NEXT_PUBLIC_APP_URL:app,NEXT_PUBLIC_MAPTILER_API_KEY:'e2e-maptiler-key'};
  for(const key of ['RESEND_API_KEY','QSTASH_TOKEN','QSTASH_CURRENT_SIGNING_KEY','QSTASH_NEXT_SIGNING_KEY','CRON_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','VAPID_PRIVATE_KEY','NEXT_PUBLIC_VAPID_PUBLIC_KEY'])env[key]='';
  execFileSync(process.execPath,['scripts/ops/copy-maplibre-worker.mjs'],{cwd:config.sourceRoot,stdio:['ignore','ignore','pipe']});
  // Generated Next files belong to this test copy, never the shared checkout.
  const appRoot=path.join(config.sourceRoot,'.cache',config.dbName+'-app');
  fs.mkdirSync(appRoot,{recursive:true});
  for(const file of ['package.json','tsconfig.json','next.config.ts','cloudflare-image-loader.ts','postcss.config.mjs','postcss.config.js','tailwind.config.ts','tailwind.config.js','next-env.d.ts','AGENTS.md']) {
    const source=path.join(config.sourceRoot,file);if(fs.existsSync(source))fs.copyFileSync(source,path.join(appRoot,file));
  }
  fs.cpSync(path.join(config.sourceRoot,'src'),path.join(appRoot,'src'),{recursive:true});
  fs.mkdirSync(path.join(appRoot,'public'),{recursive:true});
  for(const entry of fs.readdirSync(path.join(config.sourceRoot,'public')))if(entry!=='data')
    fs.cpSync(path.join(config.sourceRoot,'public',entry),path.join(appRoot,'public',entry),{recursive:true});
  fs.symlinkSync(path.join(config.sourceRoot,'node_modules'),path.join(appRoot,'node_modules'),'junction');
  console.info('Browser app snapshot prepared');
  const out=fs.openSync('.cache/unified-marketplace-browser-server.log','w');
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--port','3112','--hostname','localhost'],{cwd:appRoot,env,stdio:['ignore',out,out],windowsHide:true});
  for(let i=0;i<90;i++){try{const res=await fetch(app+'/auth');if(res.ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));if(i===89)throw Error('App did not become ready');}
  browser=await chromium.launch({headless:false});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(app+'/post');await page.waitForURL('**/auth?redirect=%2Fpost');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  check('signup has no role selector',await page.getByRole('combobox').count()===0);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Email').fill(consumer.email);await page.getByLabel('Password',{exact:true}).fill(password);
  await page.locator('form').filter({has:page.locator('input[name=email]')}).locator('button[type=submit]').click();await page.waitForURL(app+'/post');
  check('guest returns to category chooser after real sign-in');
  await page.getByRole('heading',{name:'Create listing',exact:true}).waitFor();
  const categories=page.getByRole('navigation',{name:'Listing categories'});
  check('chooser exposes all five categories',await categories.getByRole('link').count()===5);
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000});
    check('chooser fits '+width+'px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const trigger=page.getByRole('button',{name:'Open menu',exact:true});await trigger.focus();await page.keyboard.press('ArrowDown');
    check('keyboard reaches Create listing at '+width+'px',await page.getByRole('menuitem',{name:'Create listing',exact:true}).evaluate(el=>el===document.activeElement));
    check('same menu has Saved and My listings at '+width+'px',await page.getByRole('menuitem',{name:'Saved',exact:true}).count()===1&&await page.getByRole('menuitem',{name:'My listings',exact:true}).count()===1);
    await page.keyboard.press('Escape');check('Escape restores focus at '+width+'px',await trigger.evaluate(el=>el===document.activeElement));
    await page.screenshot({path:'.cache/unified-marketplace-'+width+'.png',fullPage:true});
  }
  await page.goto(app+'/post/listings');await page.getByRole('heading',{name:'My listings',exact:true}).waitFor();
  check('My listings reaches every existing category workspace',await page.getByRole('navigation',{name:'Your listing categories'}).getByRole('link').count()===5);
  // Geocoder/map responses are fixtures; UI submission, session and persistence are real.
  await page.route('https://api.maptiler.com/geocoding/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',id:'address.fixture',text:'Fixture address',place_name:'Fixture address, Cape Town, South Africa',place_type:['address'],center:[18.4241,-33.9249],geometry:{type:'Point',coordinates:[18.4241,-33.9249]},properties:{categories:[]},context:[]}]})}));
  await page.route('https://api.maptiler.com/maps/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({version:8,sources:{},layers:[]})}));
  for(const type of ['rent','sale']) {
    await page.goto(app+'/dashboard/listings/new');
    if(type==='sale')await page.getByRole('button',{name:'For sale',exact:true}).click();
    await page.getByLabel('Listing headline').fill('Browser '+type+' fixture');
    await page.getByRole('combobox',{name:'Property type'}).click();
    await page.getByRole('option',{name:'Apartment',exact:true}).click();
    await page.getByLabel(type==='sale'?'Purchase price (ZAR)':'Monthly rent (ZAR)').fill(type==='sale'?'1200000':'12000');
    await page.getByLabel(/Search address/).fill('Fixture address');
    await page.getByRole('option',{name:/^Fixture address/}).click();
    await page.getByRole('button',{name:'Create private draft',exact:true}).click();
    await page.waitForURL(/\/dashboard\/listings\/[0-9a-f-]+\/edit#gallery$/);
    check('same account creates '+type+' through the Property form',count('listings',"landlord_id='"+consumer.id+"' and title='Browser "+type+" fixture'")===1);
  }
  await page.goto(app+'/post/offers');
  let uncertain=true;
  await page.route('**/api/private/offers',async route=>{if(uncertain && JSON.parse(route.request().postData()).command==='create'){uncertain=false;const response=await route.fetch();
      if(response.ok()) await route.abort();
      else { const body=await response.json();console.info('Create rejected',response.status(),body.code,body.error);await route.fulfill({response}); }}else await route.continue();});
  await page.getByRole('button',{name:'Create private draft',exact:true}).click();await page.getByRole('alert').filter({hasText:/Could not complete|Could not confirm/}).waitFor();
  await page.getByRole('button',{name:'Create private draft',exact:true}).click();await page.waitForURL(/\/post\/offers\/[0-9a-f-]+$/);
  check('uncertain create retry produces one Shopping Special draft',count('shopping_offers',"poster_id='"+consumer.id+"'")===1);
  check('Shopping Special enrolls implicitly',count('offer_posters',"user_id='"+consumer.id+"' and revoked_at is null")===1);
  await page.unroute('**/api/private/offers');
  for(const [category,label] of [['tourism','New Place'],['event','New Event']]){
    await page.goto(app+'/post/entries/'+category);await page.getByRole('button',{name:label,exact:true}).click();await page.waitForURL(new RegExp('/post/entries/'+category+'/[0-9a-f-]+$'));
    check(category+' draft created without enrollment choice',count('pinpoint_entries',"poster_id='"+consumer.id+"' and category='"+category+"'")===1);
  }
  await page.goto(app+'/post/services');await page.getByRole('button',{name:'Add service',exact:true}).click();await page.waitForURL(/\/post\/services\/[0-9a-f-]+$/);
  check('service draft is accessible to same account',count('service_submissions',"poster_id='"+consumer.id+"'")===1);
  sql("update public.offer_posters set revoked_at=now() where user_id='"+consumer.id+"'");
  await page.goto(app+'/post/offers');await page.getByText('Poster access has been revoked. Re-enrollment cannot restore it.',{exact:true}).waitFor();
  check('revoked poster has no creation control',await page.getByRole('button',{name:'Create private draft'}).count()===0);
  check('enrollment cannot restore revoked access',!!(await consumer.client.rpc('pinpoint_offer_enroll')).error);
  check('category drafts stay private and unapproved',count('shopping_offer_decisions',"offer_id in(select id from public.shopping_offers where poster_id='"+consumer.id+"') and action='approve'")===0&&count('pinpoint_entries',"poster_id='"+consumer.id+"' and approved_revision_id is not null")===0);
  await page.goto(app+'/profile');await page.getByRole('heading',{name:/Welcome back/}).waitFor();
  check('profile has no role switch',await page.getByRole('combobox').count()===0);
  const freshContext=await browser.newContext({viewport:{width:390,height:844}});
  const fresh=await freshContext.newPage();fresh.setDefaultTimeout(60000);
  await fresh.goto(app+'/auth?redirect=%2Fpost');
  await fresh.getByRole('button',{name:'Create account',exact:true}).click();
  const freshEmail='browser-'+randomUUID()+'@example.test';
  await fresh.getByLabel('Email').fill(freshEmail);
  await fresh.getByLabel('Password',{exact:true}).fill(password);
  await fresh.getByLabel('Retype password').fill(password);
  await fresh.locator('input[name=acceptPolicies]').check();
  await fresh.locator('form').filter({has:fresh.locator('input[name=email]')}).locator('button[type=submit]').click();
  await fresh.waitForURL(app+'/post');
  const newId=sql("select id from auth.users where email='"+freshEmail+"'");accounts.push(newId);
  check('new signup skips all role selection',count('profile_personas',"profile_id='"+newId+"'")===4);
  await fresh.goto(app+'/post/services');await fresh.getByRole('button',{name:'Add service',exact:true}).click();
  await fresh.waitForURL(/\/post\/services\/[0-9a-f-]+$/);
  check('new account immediately creates a service draft',count('service_submissions',"poster_id='"+newId+"'")===1);
  await freshContext.close();
  passed = true;
} finally {
  if(browser)await browser.close();
  if(server){server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,5000);});}
  // The parent removes the entire labeled clone, including immutable fixture history.
  fs.writeFileSync(config.resultPath,JSON.stringify({checks,passed,fixturesDiscardedWithClone:true,environment:'disposable local clone and real browser; no deployment'},null,2));
}
