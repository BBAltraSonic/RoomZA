// In-memory PostgreSQL rehearsal. No hosted database, network or browser access.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "../../.cache/discovery-cards-sql/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite(), migrations = "supabase/migrations/";
const withContacts = !process.argv.includes("--without-contacts");
const contactsLast = process.argv.includes("--contacts-last");
let checks = 0;
const query = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const expectFailure = async (sql, args, code) => { await assert.rejects(db.query(sql, args), error => error.code === code); checks++; };
const apply = async file => db.exec(await readFile(migrations + file, "utf8"));
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private; create schema storage;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create table auth.mfa_factors(user_id uuid,status text,factor_type text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('test.session',true),'aal',current_setting('test.aal',true))$$;
    create table public.profiles(id uuid primary key);
    create table public.admin_memberships(user_id uuid,revoked_at timestamptz,level text);
    create table public.account_suspensions(user_id uuid,restored_at timestamptz,suspended_until timestamptz);
    create table public.trust_documents(current_version_id uuid);
    create table public.trust_document_versions(id uuid,status text,requires_reacceptance boolean,effective_at timestamptz);
    create table public.policy_acceptances(user_id uuid,version_id uuid);
    create table public.public_profiles(profile_id uuid,username text,display_name text,profile_audience text);
    create table public.discovery_places(id uuid primary key,provider_id text,level text,south double precision,north double precision,west double precision,east double precision,name text,region text,full_address text);
    create table public.listings(id uuid primary key,status text,metadata jsonb default '{}');
    create table public.service_submissions(id uuid primary key,poster_id uuid,version integer,draft jsonb,submitted jsonb);
    create table public.service_submission_events(content jsonb);
    create table public.approved_services(id uuid primary key,content jsonb);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,metadata jsonb); alter table storage.objects enable row level security;
    create function private.pinpoint_service_reviewer() returns boolean language sql as $$select false$$;
    create function private.pinpoint_service_eligible() returns boolean language sql as $$select false$$;
    create function private.pinpoint_service_visible(uuid) returns boolean language sql as $$select false$$;
  `);
  if (!withContacts || contactsLast) {
    // The media migration also extends Services. Use its real baseline validator
    // without installing unrelated Service tables or the guest-contact release.
    const source = await readFile(migrations + "20261003081807_pinpoint_local_services.sql", "utf8");
    const start = source.indexOf("create function private.pinpoint_service_content(");
    assert(start >= 0);
    await db.exec(source.slice(start, source.indexOf("$$;", start) + 3));
  }
  for (const file of ["20260930164313_pinpoint_offer_intake.sql", "20261002010000_pinpoint_offer_permission.sql", "20261002023000_pinpoint_offer_permission_review.sql", "20261002040000_pinpoint_offer_location_review.sql", "20261002060000_pinpoint_offer_decisions.sql", "20261002070000_pinpoint_offer_public_reads.sql", "20261003025344_pinpoint_entry_intake.sql", "20261003032659_pinpoint_entry_corrections.sql", "20261003100134_pinpoint_entry_publication.sql", ...(withContacts && !contactsLast ? ["20261009103541_guest_public_contacts.sql"] : []), "20261009124326_discovery_cards_media_saves.sql", "20261009151629_shared_special_details_links.sql", ...(withContacts && contactsLast ? ["20261009103541_guest_public_contacts.sql"] : [])]) await apply(file);
  const poster = randomUUID(), reviewer = randomUUID(), session = randomUUID(), reviewSession = randomUUID(), area = randomUUID();
  await db.query("insert into auth.users values ($1,now(),false,null),($2,now(),false,null)",[poster,reviewer]);
  await db.query("insert into profiles values ($1),($2)",[poster,reviewer]);
  await db.query("insert into auth.sessions values ($1,$2,null),($3,$4,null)",[session,poster,reviewSession,reviewer]);
  {
    await db.query("insert into admin_memberships values ($1,null,'admin')",[reviewer]); await db.query("insert into auth.mfa_factors values ($1,'verified','totp')",[reviewer]);
  }
  await db.query("insert into discovery_places values ($1,'fixture','place',-34,-32,17,19,'Fixture','ZA','Fixture area')",[area]);
  const as = async admin => { await db.query("select set_config('test.user',$1,false),set_config('test.session',$2,false),set_config('test.aal',$3,false)",admin ? [reviewer,reviewSession,'aal2'] : [poster,session,'aal1']); };
  const dates = { startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z" };
  const common = { title: "Fixture special", areaId: area, address: "Fixture address", latitude: -33, longitude: 18, priceCents: 0, mediaIds: [], mediaRightsConfirmed: false, ...dates, ...(withContacts ? { publicContact: { email: "fixture@example.com" }, contactConsent: true } : {}) };
  for (const validator of ['pinpoint_intake_validate','pinpoint_entry_content','pinpoint_service_content']) {
    const definition = (await query("select pg_get_functiondef(oid) as value from pg_proc where pronamespace='private'::regnamespace and proname=$1",[validator])).value;
    assert(definition.includes('private.discovery_card_validate(')); checks++;
    if (withContacts) { assert(definition.includes('private.pinpoint_contact_validate(')); checks++; }
    if (validator !== 'pinpoint_service_content') { assert(definition.includes('private.special_links_validate(')); checks++; }
  }
  const links = { visitUrl: "https://example.com/this-special?a=1#details", bookingUrl: "https://tickets.example.com/this-special" };
  for (const value of ["http://example.com/x", "javascript:alert(1)", "//example.com", "https://user:secret@example.com", "https://example.com\\evil", "https://", "https://example.com/a b", "https://example.com/" + "x".repeat(2048)]) {
    await expectFailure("select private.special_links_validate($1)",[{visitUrl:value}],"22023");
  }
  for (const category of ["event","tourism"]) for (const extra of [{},links]) {
    await as(false); await db.query("select pinpoint_entry_enroll($1)",[category]);
    const target = randomUUID(), revision = randomUUID(), content = { ...common, description: "Approved description", venueName: "Fixture venue", ...extra };
    let version = 0;
    const change = async (command,payload={},rev=null) => { const row = await query("select pinpoint_entry_write($1,$2,$3,$4,$5,$6) as value",[command,category,target,version,payload,rev]); version = row.value.version; return row.value; };
    await change("create"); await change("save",content);
    assert.deepEqual((await query("select draft from pinpoint_entries where id=$1",[target])).draft,content); checks++;
    await change("submit",{},revision);
    assert.equal((await query("select content from pinpoint_entry_revisions where id=$1",[revision])).content.bookingUrl,extra.bookingUrl); checks++;
    await db.query("select pinpoint_entry_confirm_permission($1,$2,$3,$4)",[category,target,revision,version]);
    await as(true);
    const approved=await query("select pinpoint_entry_approve($1,$2,$3,$4,'Fixture authority','Fixture venue/date evidence','none') as value",[category,target,revision,version]); version=approved.value.version;
    const published=(await query("select pinpoint_entry_public_detail($1) as value",[target])).value;
    assert.equal(published.item.content.visitUrl,extra.visitUrl); assert.equal(published.item.content.bookingUrl,extra.bookingUrl); checks+=2;
    await expectFailure("update pinpoint_entry_revisions set content='{}' where id=$1",[revision],"42501");
    await as(false); await change("save",{...content,visitUrl:"https://example.com/changed"});
    assert.equal((await query("select pinpoint_entry_public_detail($1) as value",[target])).value.item.content.visitUrl,extra.visitUrl); checks++;
    await change("submit",{},randomUUID());
    assert.equal((await query("select pinpoint_entry_public_detail($1) as value",[target])).value.item,null); checks++;
    await change("withdraw");
    assert.equal((await query("select pinpoint_entry_public_detail($1) as value",[target])).value.item,null); checks++;
  }
  // Shopping uses the actual permission, evidence, approval and public-snapshot functions.
  await as(false); await db.query("select pinpoint_offer_enroll()");
  for (const extra of [{},links]) {
    const target=randomUUID(),revision=randomUUID(),permission=randomUUID(),location=randomUUID();
    const content={...common,benefit:"Fixture benefit",terms:"Fixture terms",shopName:"Fixture shop",...extra};
    let version=0;
    const write=async(command,payload={})=>{const row=await query("select pinpoint_offer_write($1,$2,$3,$4,null) as value",[command,target,version,payload]);version=row.value.version;};
    await write("create"); await write("save",content);
    const submitted=await query("select pinpoint_offer_submit_permission($1,$2,$3,true,'shop-authorization-v1') as value",[target,revision,version]);version=submitted.value.version;
    await as(true);
    await db.query("select pinpoint_offer_permission_review_write($1,$2,$3,$4,'written_authorization','Fixture authority','Fixture evidence',true,'admin-permission-review-v1')",[target,revision,version,permission]);
    const place=(await query("select to_jsonb(p) as value from discovery_places p where id=$1",[area])).value;
    await db.query("select pinpoint_offer_location_review_write($1,$2,$3,$4,$5,$6,'Fixture provenance','Fixture shop','Fixture notes',true,true,true,true,'admin-location-review-v1')",[target,revision,version,location,permission,place]);
    const approved=await query("select pinpoint_offer_approve($1,$2,$3,$4,$5,$6,true,'admin-offer-approval-v1') as value",[target,revision,version,randomUUID(),permission,location]);version=approved.value.version;
    const snapshot=(await query("select private.pinpoint_offer_public_snapshot($1,now()) as value",[target])).value;
    assert.equal(snapshot.status,"live"); assert.equal(snapshot.content.visitUrl,extra.visitUrl); assert.equal(snapshot.content.bookingUrl,extra.bookingUrl); checks+=3;
    await expectFailure("update shopping_offer_revisions set content='{}' where id=$1",[revision],"42501");
    await as(false); await write("save",{...content,visitUrl:"https://example.com/changed"});
    assert.equal((await query("select private.pinpoint_offer_public_snapshot($1,now()) as value",[target])).value.content.visitUrl,extra.visitUrl); checks++;
    await write("withdraw");
    assert.equal((await query("select private.pinpoint_offer_public_snapshot($1,now()) as value",[target])).value,null); checks++;
  }
  console.log(`Shared Special details: ${checks} isolated PostgreSQL checks passed (${withContacts ? "with" : "without"} guest-contact migration). Real intake/review/publication functions; synthetic accounts and stored place. No hosted data changed.`);
} catch (error) { console.error({ message:error.message, code:error.code, where:error.where }); process.exitCode=1; }
finally { await db.close(); }
