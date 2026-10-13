// In-memory PostgreSQL rehearsal using real intake/review/publication functions.
// Synthetic accounts and Storage metadata only; no hosted database or HTTP writes.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "../../.cache/discovery-cards-sql/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite(), migrations = "supabase/migrations/";
const withContacts = !process.argv.includes("--without-contacts");
let checks = 0, stage = "setup";
const query = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const fails = async (sql, args, code = "22023") => { await assert.rejects(db.query(sql, args), error => error.code === code); checks++; };
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
    create function private.pinpoint_service_eligible() returns boolean language sql as $$select true$$;
    create function private.pinpoint_service_visible(uuid) returns boolean language sql as $$select exists(select 1 from public.approved_services where id=$1)$$;
  `);
  if (!withContacts) {
    const source = await readFile(migrations + "20261003081807_pinpoint_local_services.sql", "utf8");
    const start = source.indexOf("create function private.pinpoint_service_content(");
    assert(start >= 0);
    await db.exec(source.slice(start, source.indexOf("$$;", start) + 3));
  }
  for (const file of ["20260930164313_pinpoint_offer_intake.sql", "20261002010000_pinpoint_offer_permission.sql", "20261002023000_pinpoint_offer_permission_review.sql", "20261002040000_pinpoint_offer_location_review.sql", "20261002060000_pinpoint_offer_decisions.sql", "20261002070000_pinpoint_offer_public_reads.sql", "20261003025344_pinpoint_entry_intake.sql", "20261003032659_pinpoint_entry_corrections.sql", "20261003100134_pinpoint_entry_publication.sql", ...(withContacts ? ["20261009103541_guest_public_contacts.sql"] : []), "20261009124326_discovery_cards_media_saves.sql", "20261009151629_shared_special_details_links.sql"]) await apply(file);
  // Match Supabase's Storage table grants so the real policies can be exercised.
  await db.exec("grant usage on schema storage,private to anon,authenticated; grant select on storage.objects to anon,authenticated");

  const poster = randomUUID(), reviewer = randomUUID(), session = randomUUID(), reviewSession = randomUUID(), area = randomUUID();
  await db.query("insert into auth.users values ($1,now(),false,null),($2,now(),false,null)", [poster, reviewer]);
  await db.query("insert into profiles values ($1),($2)", [poster, reviewer]);
  await db.query("insert into auth.sessions values ($1,$2,null),($3,$4,null)", [session, poster, reviewSession, reviewer]);
  await db.query("insert into admin_memberships values ($1,null,'admin')", [reviewer]);
  await db.query("insert into auth.mfa_factors values ($1,'verified','totp')", [reviewer]);
  await db.query("insert into discovery_places values ($1,'fixture','place',-34,-32,17,19,'Fixture','ZA','Fixture area')", [area]);
  const as = async admin => db.query("select set_config('test.user',$1,false),set_config('test.session',$2,false),set_config('test.aal',$3,false)", admin ? [reviewer, reviewSession, "aal2"] : [poster, session, "aal1"]);
  const common = { title: "Fixture Special", areaId: area, address: "Fixture address", latitude: -33, longitude: 18,
    startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", visitUrl: "https://example.com/post",
    ...(withContacts ? { publicContact: { email: "fixture@example.com" }, contactConsent: true } : {}) };
  const tables = ["shopping_offers", "shopping_offer_revisions", "shopping_offer_events", "pinpoint_entries", "pinpoint_entry_revisions", "approved_entry_specials", "discovery_media", "saved_specials", "listings", "service_submissions", "approved_services"];
  const fingerprints = async () => Promise.all(tables.map(async table => [table, (await query(`select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) as value from public.${table} t`)).value]));
  const cards = async record => (await query("select discovery_card_presentation($1) as value", [[{ id: record.id, category: record.category }]])).value;

  async function create(category, count = 0) {
    stage = `create ${category} with ${count} photos`;
    await as(false);
    if (category === "shopping") await db.query("select pinpoint_offer_enroll()");
    else await db.query("select pinpoint_entry_enroll($1)", [category]);
    const record = { category, id: randomUUID(), revision: randomUUID(), version: 0, media: [],
      content: category === "shopping" ? { ...common, benefit: "Benefit", terms: "Terms", shopName: "Shop" } : { ...common, description: "Description", venueName: "Venue" } };
    record.write = async (command, payload = {}) => {
      const row = category === "shopping" ? await query("select pinpoint_offer_write($1,$2,$3,$4,null) as value", [command, record.id, record.version, payload])
        : await query("select pinpoint_entry_write($1,$2,$3,$4,$5,null) as value", [command, category, record.id, record.version, payload]);
      record.version = row.value.version;
      return row.value;
    };
    await record.write("create");
    for (let index = 0; index < count; index++) record.media.push(await photo(record));
    if (count) Object.assign(record.content, { mediaIds: record.media.map(item => item.id).reverse(), mediaRightsConfirmed: true });
    await record.write("save", record.content);
    return record;
  }
  async function photo(record) {
    stage = `upload ${record.category} photo, version ${record.version}, after ${checks} checks`;
    const item = (await query("select discovery_media_manage('reserve',$1,$2,$3,null,'image/jpeg',100) as value", [record.category, record.id, record.version])).value;
    await db.query("insert into storage.objects values('discovery-media',$1,$2)", [item.path, { size: 100, mimetype: "image/jpeg" }]);
    await db.query("select discovery_media_manage('complete',$1,$2,null,$3)", [record.category, record.id, item.id]);
    return item;
  }
  async function submit(record) {
    await as(false);
    const result = record.category === "shopping"
      ? await query("select pinpoint_offer_submit_permission($1,$2,$3,true,'shop-authorization-v1') as value", [record.id, record.revision, record.version])
      : await query("select pinpoint_entry_write('submit',$1,$2,$3,'{}',$4) as value", [record.category, record.id, record.version, record.revision]);
    record.version = result.value.version;
    if (record.category !== "shopping") await db.query("select pinpoint_entry_confirm_permission($1,$2,$3,$4)", [record.category, record.id, record.revision, record.version]);
  }
  async function approve(record) {
    await as(true);
    let result;
    if (record.category === "shopping") {
      const permission = randomUUID(), location = randomUUID();
      await db.query("select pinpoint_offer_permission_review_write($1,$2,$3,$4,'written_authorization','Fixture authority','Fixture evidence',true,'admin-permission-review-v1')", [record.id, record.revision, record.version, permission]);
      const place = (await query("select to_jsonb(p) as value from discovery_places p where id=$1", [area])).value;
      await db.query("select pinpoint_offer_location_review_write($1,$2,$3,$4,$5,$6,'Fixture provenance','Fixture shop','Fixture notes',true,true,true,true,'admin-location-review-v1')", [record.id, record.revision, record.version, location, permission, place]);
      result = await query("select pinpoint_offer_approve($1,$2,$3,$4,$5,$6,true,'admin-offer-approval-v1') as value", [record.id, record.revision, record.version, randomUUID(), permission, location]);
    } else result = await query("select pinpoint_entry_approve($1,$2,$3,$4,'Fixture authority','Fixture venue/date evidence',$5) as value", [record.category, record.id, record.revision, record.version, record.media.length ? "reviewed" : "none"]);
    record.version = result.value.version;
    await as(false);
  }
  const legacy = [], pending = [];
  for (const category of ["shopping", "tourism", "event"]) {
    const published = await create(category); await submit(published); await approve(published); legacy.push(published);
    const submitted = await create(category); await submit(submitted); pending.push(submitted);
  }
  const before = await fingerprints();
  const permissions = (await query("select array_agg(proacl::text order by oid) as value from pg_proc where oid in ('private.pinpoint_offer_write(text,uuid,integer,jsonb,uuid)'::regprocedure,'private.pinpoint_entry_write(text,text,uuid,integer,jsonb,uuid)'::regprocedure,'public.discovery_media_manage(text,text,uuid,integer,uuid,text,integer)'::regprocedure,'private.discovery_card_validate(jsonb,boolean,boolean)'::regprocedure)")).value;
  await apply("20261011113405_specials_photo_galleries.sql");
  equal(await fingerprints(), before);
  equal((await query("select array_agg(proacl::text order by oid) as value from pg_proc where oid in ('private.pinpoint_offer_write(text,uuid,integer,jsonb,uuid)'::regprocedure,'private.pinpoint_entry_write(text,text,uuid,integer,jsonb,uuid)'::regprocedure,'public.discovery_media_manage(text,text,uuid,integer,uuid,text,integer)'::regprocedure,'private.discovery_card_validate(jsonb,boolean,boolean)'::regprocedure)")).value, permissions);
  for (const record of legacy) equal((await cards(record))[0].media, []);
  for (const record of pending) { await approve(record); equal((await cards(record))[0].media, []); }

  for (const category of ["shopping", "tourism", "event"]) {
    const empty = await create(category);
    await assert.rejects(submit(empty), error => error.code === "22023" && error.message.includes("photos")); checks++;
    for (const count of [1, 10]) {
      const record = await create(category, count);
      equal(await cards(record), []);
      await db.query("select set_config('test.user','',false)"); await db.exec("set role anon");
      equal((await query("select count(*)::int as value from storage.objects where name=$1", [record.media[0].path])).value, 0);
      await db.exec("reset role"); await as(false);
      await fails("select discovery_media_manage('reserve',$1,$2,$3,null,'image/jpeg',100)", [category, record.id, record.version - 1], "PT409");
      await as(true);
      await fails("select discovery_media_manage('reserve',$1,$2,$3,null,'image/jpeg',100)", [category, record.id, record.version], "42501");
      await as(false);
      await fails(category === "shopping" ? "select pinpoint_offer_write('save',$1,$2,$3,null)" : "select pinpoint_entry_write('save',$4,$1,$2,$3,null)",
        category === "shopping" ? [record.id, record.version, { ...record.content, mediaIds: [randomUUID()] }] : [record.id, record.version, { ...record.content, mediaIds: [randomUUID()] }, category]);
      await record.write("save", { ...record.content, mediaRightsConfirmed: false });
      await assert.rejects(submit(record), error => error.code === "22023"); checks++;
      await record.write("save", record.content);
      await submit(record);
      await fails("select discovery_media_manage('delete',$1,$2,null,$3)", [category, record.id, record.media[0].id]);
      await approve(record);
      equal((await cards(record))[0].media.map(photo => photo.id), record.content.mediaIds);
      await db.query("select set_config('test.user','',false)"); await db.exec("set role anon");
      equal((await cards(record))[0].media.map(photo => photo.id), record.content.mediaIds);
      equal((await query("select count(*)::int as value from storage.objects where name=$1", [record.media[0].path])).value, 1);
      await db.exec("reset role"); await as(false);
      const table = category === "shopping" ? "shopping_offer_revisions" : "pinpoint_entry_revisions";
      await fails(`update public.${table} set content='{}' where id=$1`, [record.revision], "42501");
      await record.write("save", { ...record.content, mediaIds: [...record.content.mediaIds].reverse() });
      equal((await cards(record))[0].media.map(photo => photo.id), record.content.mediaIds);
      const eleven = Array.from({ length: 11 }, () => randomUUID());
      await fails("select private.discovery_card_validate($1,false,true)", [{ ...record.content, mediaIds: eleven }]);
      await fails("select private.discovery_card_validate($1,false,true)", [{ ...record.content, mediaIds: [record.media[0].id, record.media[0].id] }]);
      await record.write("withdraw"); equal(await cards(record), []);
      await db.query("select set_config('test.user','',false)"); await db.exec("set role anon");
      equal((await query("select count(*)::int as value from storage.objects where name=$1", [record.media[0].path])).value, 0);
      await db.exec("reset role"); await as(false);
    }
  }
  const uploads = await create("event");
  await db.query("update entry_posters set revoked_at=now() where user_id=$1 and category='event'", [poster]);
  await fails("select discovery_media_manage('reserve','event',$1,$2,null,'image/jpeg',100)", [uploads.id, uploads.version], "42501");
  await db.query("update entry_posters set revoked_at=null where user_id=$1 and category='event'", [poster]);
  for (let index = 0; index < 20; index++) await photo(uploads);
  await fails("select discovery_media_manage('reserve','event',$1,$2,null,'image/jpeg',100)", [uploads.id, uploads.version]);
  checks++;
  const service = { category: "service", id: randomUUID(), version: 1 };
  await db.query("insert into service_submissions values($1,$2,1,'{}',null)", [service.id, poster]);
  const serviceMedia = [];
  for (let index = 0; index < 20; index++) serviceMedia.push((await photo(service)).id);
  await db.query("select private.discovery_card_validate($1,true,false)", [{ mediaIds: serviceMedia, mediaRightsConfirmed: true }]); checks++;
  await fails("select private.discovery_card_validate($1,true,false)", [{ mediaIds: [...serviceMedia, randomUUID()], mediaRightsConfirmed: true }]);
  equal((await query("select has_function_privilege('anon','private.special_submission_media_validate(jsonb)','execute') as value")).value, false);
  equal((await query("select has_function_privilege('authenticated','private.special_submission_media_validate(jsonb)','execute') as value")).value, false);
  console.log(`Special galleries: ${checks} isolated PostgreSQL checks passed (${withContacts ? "with" : "without"} guest-contact migration). Legacy approvals, immutable ordered galleries, new submission minimum, upload quotas and ownership. No hosted data changed.`);
} catch (error) { console.error({ stage, message: error.message, code: error.code, where: error.where }); process.exitCode = 1; }
finally { await db.close(); }
