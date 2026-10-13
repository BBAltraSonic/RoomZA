// Isolated PostgreSQL validation. Does not connect to Supabase or production.
// Runtime: npm install --prefix .cache/guest-contact-db --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.8
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "../../.cache/guest-contact-db/node_modules/@electric-sql/pglite/dist/index.js";

process.on("uncaughtException", error => { console.error({ code:error.code, message:error.message, where:error.where, position:error.position }); process.exit(1); });
const db = new PGlite();
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12,"0");
const json = value => "'" + JSON.stringify(value).replaceAll("'","''") + "'::jsonb";
let checks = 0;
async function rejects(sql, code) { await assert.rejects(db.exec(sql), error => !code || error.code === code); checks++; }
async function succeeds(sql) { await db.exec(sql); checks++; }
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema private;
  create table public.listings(id uuid primary key,status text,metadata jsonb default '{}');
  alter table public.listings enable row level security;
  create policy published_listing_read on public.listings for select to anon,authenticated using(status='published');
  grant select on public.listings to anon,authenticated;
  create table public.shopping_offers(id uuid primary key,poster_id uuid,pending_revision_id uuid,withdrawn_at timestamptz,version integer default 1);
  create table public.shopping_offer_revisions(id uuid primary key,offer_id uuid,poster_id uuid,content jsonb);
  create table public.shopping_offer_decisions(id uuid primary key,offer_id uuid,revision_id uuid,poster_id uuid,action text,version integer,captured_version integer,statement_version text,occurred_at timestamptz,permission_review_id uuid,location_review_id uuid);
  create table public.shopping_offer_permission_reviews(id uuid primary key,offer_id uuid,revision_id uuid,poster_id uuid,offer_version integer,statement_version text);
  create table public.shopping_offer_location_reviews(id uuid primary key,offer_id uuid,revision_id uuid,poster_id uuid,offer_version integer,permission_review_id uuid,statement_version text,place_id uuid,place_snapshot jsonb);
  create table public.shopping_offer_permissions(offer_id uuid,revision_id uuid,poster_id uuid,statement_version text);
  create table public.pinpoint_entries(id uuid primary key);
  create table public.approved_entry_specials(id uuid primary key,content jsonb);
  create table public.service_submissions(id uuid primary key);
  create table public.approved_services(id uuid primary key,content jsonb);
  create table public.discovery_places(id uuid primary key,provider_id text,level text,south double precision,north double precision,west double precision,east double precision,name text,region text,full_address text);
  create table public.public_profiles(profile_id uuid,username text,display_name text,profile_audience text);
  create function private.pinpoint_offer_poster_eligible(target uuid) returns boolean language sql as $$select true$$;
`);
await db.exec("insert into public.listings(id,status) values ('"+id(1)+"','published'),('"+id(2)+"','draft'); insert into public.shopping_offers(id) values ('"+id(3)+"'); insert into public.shopping_offer_decisions(id,offer_id,action) values ('"+id(30)+"','"+id(3)+"','approve'); insert into public.pinpoint_entries values ('"+id(4)+"'); insert into public.approved_entry_specials values ('"+id(4)+"','{}'); insert into public.service_submissions values ('"+id(5)+"'); insert into public.approved_services values ('"+id(5)+"','{\"phone\":\"021 555 0100\"}');");
if (process.argv.includes('--installed-validators')) {
 const raw = JSON.parse(await readFile('.cache/all-work-release-20261009/database-before.json','utf8'));
 const result = JSON.parse(raw.content[0].text).result;
 const evidence = JSON.parse(result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/)[1])[0].evidence;
 for (const installed of evidence.functions) await db.exec(installed.definition);
}
await db.exec(await readFile(new URL("../../supabase/migrations/20261009103541_guest_public_contacts.sql",import.meta.url),"utf8"));
checks++;
assert.equal((await db.query("select guest_contact_exempt from public.listings where id=$1",[id(1)])).rows[0].guest_contact_exempt,true);
assert.equal((await db.query("select guest_contact_exempt from public.listings where id=$1",[id(2)])).rows[0].guest_contact_exempt,false);
checks+=2;
const contact = { publicContact:{phone:"+27215550100",whatsapp:"+27215550101",email:"help@example.com"},contactConsent:true };
if (process.argv.includes('--installed-validators')) {
 await succeeds("select private.pinpoint_intake_validate("+json({...contact,priceCents:0,mediaIds:[],mediaRightsConfirmed:false,visitUrl:'https://example.com/special',bookingUrl:'https://example.com/book'})+",false)");
 await rejects("select private.pinpoint_intake_validate("+json({...contact,visitUrl:'http://example.com'})+",false)",'22023');
 await rejects("select private.pinpoint_intake_validate("+json({...contact,priceCents:-1})+",false)",'22023');
 await rejects("select private.pinpoint_entry_content("+json({...contact,mediaIds:['invalid']})+",false)",'22023');
 await succeeds("select private.pinpoint_service_content("+json({...contact,mediaIds:[],mediaRightsConfirmed:false})+",false)");
}
await rejects("update public.listings set status='published' where id='"+id(2)+"'","22023");
await succeeds("update public.listings set metadata="+json(contact)+",status='published' where id='"+id(2)+"'");
await rejects("update public.listings set metadata='{}' where id='"+id(2)+"'","22023");
await succeeds("update public.listings set metadata='{}' where id='"+id(1)+"'");
await rejects("update public.listings set guest_contact_exempt=true where id='"+id(2)+"'","42501");
await rejects("insert into public.listings(id,status,guest_contact_exempt) values ('"+id(6)+"','published',true)","22023");
for(const bad of [{publicContact:{phone:"0215550100"},contactConsent:true},{publicContact:{whatsapp:"https://evil.test"},contactConsent:true},{publicContact:{email:"x@example.com\r\nBcc:other@example.com"},contactConsent:true},{publicContact:{extra:"hidden"},contactConsent:true},{publicContact:contact.publicContact,contactConsent:false}]) {
 await rejects("select private.pinpoint_contact_validate("+json(bad)+",true)","22023");
}
await succeeds("select private.pinpoint_contact_validate("+json(contact)+",true)");
for(const table of ['approved_entry_specials','approved_services']) {
 await rejects("insert into public."+table+"(id,content) values ('"+id(7)+"',"+json({phone:"021 555 0100"})+")","22023");
 await succeeds("insert into public."+table+"(id,content) values ('"+id(7)+"',"+json({...contact,phone:"021 555 0100"})+")");
 await rejects("update public."+table+" set content='{}' where id='"+id(7)+"'","22023");
}
await succeeds("update public.approved_services set content='{\"phone\":\"021 555 0100\"}' where id='"+id(5)+"'");
await rejects("update public.approved_services set content='{\"phone\":\"021 555 0101\"}' where id='"+id(5)+"'","22023");
await succeeds("update public.approved_services set content="+json({phone:"021 555 0101",contactConsent:true})+" where id='"+id(5)+"'");
for(const table of ['shopping_offers','pinpoint_entries','service_submissions']) {
 await succeeds("insert into public."+table+"(id,guest_contact_exempt) values ('"+id(8)+"',true)");
 assert.equal((await db.query("select guest_contact_exempt from public."+table+" where id=$1",[id(8)])).rows[0].guest_contact_exempt,false);checks++;
 await rejects("update public."+table+" set guest_contact_exempt=true where id='"+id(8)+"'","42501");
}
const content={title:"Public offer",benefit:"A special",terms:"Terms",shopName:"Shop",areaId:id(90),address:"Demo",latitude:-33,longitude:18,startsAt:"2020-01-01T00:00:00.000Z",endsAt:"2099-01-01T00:00:00.000Z",...contact};
await db.exec("insert into public.discovery_places values ('"+id(90)+"','fixture','place',-34,-32,17,19,'Demo','Cape Town','Demo'); insert into public.shopping_offers(id,poster_id,version) values ('"+id(91)+"','"+id(99)+"',2); insert into public.shopping_offer_revisions values ('"+id(92)+"','"+id(91)+"','"+id(99)+"',"+json(content)+");");
await rejects("insert into public.shopping_offer_decisions(id,offer_id,revision_id,action) values ('"+id(95)+"','"+id(91)+"','"+id(93)+"','approve')","22023");
await db.exec("insert into public.shopping_offer_permission_reviews values ('"+id(93)+"','"+id(91)+"','"+id(92)+"','"+id(99)+"',1,'admin-permission-review-v1'); insert into public.shopping_offer_permissions values ('"+id(91)+"','"+id(92)+"','"+id(99)+"','shop-authorization-v1'); insert into public.shopping_offer_location_reviews values ('"+id(94)+"','"+id(91)+"','"+id(92)+"','"+id(99)+"',1,'"+id(93)+"','admin-location-review-v1','"+id(90)+"',(select to_jsonb(p) from public.discovery_places p where id='"+id(90)+"')); insert into public.shopping_offer_decisions(id,offer_id,revision_id,poster_id,action,version,captured_version,statement_version,occurred_at,permission_review_id,location_review_id) values ('"+id(95)+"','"+id(91)+"','"+id(92)+"','"+id(99)+"','approve',2,1,'admin-offer-approval-v1',now(),'"+id(93)+"','"+id(94)+"');");
const snapshot=await db.query("select private.pinpoint_offer_public_snapshot($1,now()) as value",[id(91)]);
assert.deepEqual(snapshot.rows[0].value.content.publicContact,contact.publicContact);checks++;
for (const [instant,state] of [["2019-01-01T00:00:00Z","scheduled"],["2099-01-02T00:00:00Z","expired"]]) {
 const value=(await db.query("select private.pinpoint_offer_public_snapshot($1,$2::timestamptz) as value",[id(91),instant])).rows[0].value;
 assert.equal(value.status,state); assert.equal(value.content,null);checks++;
}
await succeeds("update public.shopping_offers set withdrawn_at=now() where id='"+id(91)+"'");
assert.equal((await db.query("select private.pinpoint_offer_public_snapshot($1,now()) as value",[id(91)])).rows[0].value,null);checks++;
await db.exec("update public.shopping_offers set withdrawn_at=null where id='"+id(91)+"'");
await succeeds("update public.shopping_offers set pending_revision_id='"+id(92)+"' where id='"+id(91)+"'");
assert.equal((await db.query("select private.pinpoint_offer_public_snapshot($1,now()) as value",[id(91)])).rows[0].value,null);checks++;
await db.exec("insert into public.listings(id,status,metadata) values ('"+id(9)+"','draft',"+json(contact)+")");
for(const role of ['anon','authenticated']) {
 await db.exec('set role '+role);
 const result=(await db.query("select public.pinpoint_property_contacts($1) as value",[[id(1),id(2),id(9)]])).rows[0].value;
 assert.deepEqual(result,{[id(2)]:contact.publicContact});checks++;
 await rejects("insert into public.listings(id,status) values ('"+id(10)+"','published')","42501");
 await rejects("update public.listings set status='draft'","42501");
 await rejects("select * from private.guest_contact_legacy_publications","42501");
 await rejects("select private.pinpoint_guest_publication_guard()","42501");
 await rejects("select public.pinpoint_property_contacts(array_fill('"+id(2)+"'::uuid,array[501]))","22023");
 await db.exec('reset role');
}
await db.close();
console.log('Guest contact migration: '+checks+' PostgreSQL checks passed (isolated fixture, no hosted data).');
