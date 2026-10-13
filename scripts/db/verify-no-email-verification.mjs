// Local PostgreSQL behavioral checks; never connects to hosted data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '../../.cache/guest-contact-db/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
const user='11111111-1111-4111-8111-111111111111', session='22222222-2222-4222-8222-222222222222';
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema private;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',current_setting('test.session',true))$$;
create function private.pinpoint_intake_reviewer() returns boolean language sql as $$select current_setting('test.reviewer',true)='true'$$;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create table public.profiles(id uuid primary key,email_verified_at timestamptz,active_organization_id uuid);
create table public.account_suspensions(user_id uuid,restored_at timestamptz,suspended_until timestamptz);
create table public.trust_document_versions(id uuid,status text,requires_reacceptance boolean,effective_at timestamptz);
create table public.trust_documents(current_version_id uuid);
create table public.policy_acceptances(user_id uuid,version_id uuid);
create table public.offer_posters(user_id uuid,revoked_at timestamptz);
create table public.entry_posters(user_id uuid,category text,revoked_at timestamptz);
create table public.approved_entry_specials(id uuid,revision_id uuid,area_id uuid,content jsonb,category text);
create table public.pinpoint_entries(id uuid,poster_id uuid,category text,approved_revision_id uuid,withdrawn_at timestamptz,pending_revision_id uuid);
create table public.pinpoint_entry_publication_reviews(entry_id uuid,revision_id uuid,permission_id uuid,area_id uuid,place_snapshot jsonb);
create table public.pinpoint_entry_permissions(id uuid,revision_id uuid);
create table public.discovery_places(id uuid);
create table public.listings(id uuid);
create table public.profile_personas(profile_id uuid,persona text);
insert into auth.users values('${user}',null,false,null);
insert into public.profiles values('${user}',null,null);
insert into auth.sessions values('${session}','${user}',null);
insert into public.offer_posters values('${user}',null);
insert into public.entry_posters values('${user}','tourism',null);
select set_config('test.uid','${user}',false),set_config('test.session','${session}',false),set_config('test.reviewer','true',false);
`);
const before=JSON.parse(fs.readFileSync('docs/no-email-verification-20261012/functions-before.json','utf8'));
// Preserve the installed restricted grants across CREATE OR REPLACE.
for(const f of before) {
  await db.exec(f.definition);
  const signature=f.signature.startsWith('private.')?f.signature:'public.'+f.signature;
  await db.exec(`revoke all on function ${signature} from public,anon,authenticated;`);
}
const acl=await db.query("select p.oid,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') order by p.oid");
await db.exec(fs.readFileSync('supabase/migrations/20261012004142_remove_email_verification.sql','utf8'));
assert.deepEqual((await db.query("select p.oid,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') order by p.oid")).rows,acl.rows);
let checks=1;
const guards=[
 'private.pinpoint_intake_eligible()', 'private.pinpoint_service_eligible()',
 `private.pinpoint_offer_poster_eligible('${user}')`, `private.pinpoint_entry_subject_eligible('${user}','tourism')`,
 `public.pinpoint_active_session('${user}','${session}')`,
];
async function all(expected,subset=guards) { for(const call of subset) { assert.equal((await db.query('select '+call+' as allowed')).rows[0].allowed,expected,call); checks++; } }
await all(true);
await db.exec("select set_config('test.uid','',false)"); await all(false,guards.slice(0,2));
await db.exec(`select set_config('test.uid','${user}',false); update auth.users set is_anonymous=true`); await all(false);
await db.exec("update auth.users set is_anonymous=false,banned_until=now()+interval '1 day'"); await all(false);
await db.exec(`update auth.users set banned_until=null;insert into public.account_suspensions values('${user}',null,null)`); await all(false);
await db.exec("delete from public.account_suspensions;update auth.sessions set not_after=now()-interval '1 hour'"); await all(false,[...guards.slice(0,2),guards[4]]);
await db.exec("update auth.sessions set not_after=null;select set_config('test.session','33333333-3333-4333-8333-333333333333',false)"); await all(false,guards.slice(0,2));
await db.exec(`select set_config('test.session','${session}',false);update public.offer_posters set revoked_at=now();update public.entry_posters set revoked_at=now()`); await all(false,guards.slice(2,4));
await db.exec("update public.offer_posters set revoked_at=null;update public.entry_posters set revoked_at=null;select set_config('test.reviewer','false',false)"); await all(false,[guards[3]]);
await db.exec(`select set_config('test.reviewer','true',false);insert into public.trust_document_versions values('${session}','published',true,now());insert into public.trust_documents values('${session}')`); await all(false,guards.slice(0,4));
await db.exec(`insert into public.policy_acceptances values('${user}','${session}')`); await all(true);
assert.equal((await db.query(`select private.pinpoint_entry_subject_eligible('${user}','event') as allowed`)).rows[0].allowed,false);checks++;
// Empty/unreviewed publications remain hidden even without email confirmation.
assert.equal((await db.query(`select private.pinpoint_entry_public_eligible('${user}') as allowed`)).rows[0].allowed,false);checks++;
await assert.rejects(db.query(`select public.pinpoint_property_save('${user}','${session}',now(),'{}')`),e=>e.code==='42501');checks++;
await assert.rejects(db.query(`select public.pinpoint_property_lifecycle('${user}','${session}','${session}',now(),'invalid')`),e=>e.code==='22023');checks++;
console.log(JSON.stringify({checks,passed:true,hostedWrites:false}));
await db.close();
