/**
 * Explicitly authorized, bounded live demo import.
 * Credentials stay in process memory. SQL is exported for the connected Supabase
 * execute_sql tool; no migrations, ACL changes, or trigger disabling are used.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { offerContentSchema } from "../../src/features/offers/schema.ts";
import { entryContentSchema } from "../../src/features/entries/schema.ts";
import { serviceContentSchema } from "../../src/features/services/schema.ts";

const PROJECT = "qleeedwnnfvmfjjymoco";
const AREA = "b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb";
const BASE = "https://roomza.pinpoint-roomza.workers.dev";
const URL = "https://" + PROJECT + ".supabase.co";
const directory = path.resolve("artifacts/demo-listings/2026-10-08");
const manifestPath = path.join(directory, "manifest.json");
const disclaimer = "Fictional demo for previewing Pinpoint cards. No actual property, offer, booking, event or service is available. Locations are approximate demo map points; do not visit or contact.";
const provenance = "User-authorized live demo import 2026-10-08. Fictional preview content only; no real merchant/venue/provider permission, verification or marketplace supply is claimed.";
const q = value => value == null ? "null" : "'" + String(value).replaceAll("'", "''") + "'";
const j = value => q(JSON.stringify(value)) + "::jsonb";
const save = m => writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n");
mkdirSync(directory, { recursive: true });
const mode = process.argv[2];
const apply = process.argv.includes("--apply");
function load() {
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(m.project, PROJECT);
  assert.equal(m.areaId, AREA);
  assert.equal(m.accounts.length, 5);
  assert.equal(m.listings.length, 10);
  assert.equal(new Set(m.listings.map(x => x.id)).size, 10);
  assert.equal(new Set(m.accounts.map(x => x.email)).size, 5);
  return m;
}
function admin() {
  let keys;
  try {
    keys = JSON.parse(execSync("node_modules\\.bin\\supabase.cmd projects api-keys --project-ref " + PROJECT + " --reveal --output json", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }));
  } catch { throw new Error("Secure CLI credential discovery failed; values withheld"); }
  const key = keys.find(k => k.name === "service_role" && !k.disabled);
  assert.ok(key?.api_key, "No active service-role key available");
  return createClient(URL, key.api_key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function requireApply() { assert.ok(apply, "Remote writes require explicit --apply"); }
function validate(m) {
  for (const x of m.listings) {
    assert.match(x.title, /^Demo /);
    assert.ok(x.latitude >= -33.9789985671265 && x.latitude <= -33.9510023813502);
    assert.ok(x.longitude >= 18.4558839350939 && x.longitude <= 18.495838791132);
    if (x.kind === "shopping") offerContentSchema.parse(x.content);
    if (x.kind === "tourism" || x.kind === "event") entryContentSchema.parse(x.content);
    if (x.kind === "service") serviceContentSchema.parse(x.content);
  }
}
if (mode === "prepare") {
  if (existsSync(manifestPath)) {
    const m = load(); validate(m); console.log("Existing manifest reused; no new IDs generated");
  } else {
    const at = Date.now(), iso = delta => new Date(at + delta).toISOString();
    const batch = randomUUID();
    const accounts = ["property", "shopping", "tourism", "events", "services"].map(kind => ({ kind, id: null, email: "demo-" + kind + "-20261008@pinpoint.invalid", name: "Demo " + ({ property: "Property Owner", shopping: "Shopping Poster", tourism: "Tourism Poster", events: "Events Poster", services: "Services Provider" })[kind] }));
    const definitions = [
      ["property", "Demo Rondebosch two-bedroom apartment", "property", -33.9670, 18.4862],
      ["property", "Demo Rondebosch family house for sale", "property", -33.9658, 18.4838],
      ["shopping", "Demo grocery basket special", "shopping", -33.9682, 18.4871],
      ["shopping", "Demo cafe coffee and pastry special", "shopping", -33.9676, 18.4882],
      ["tourism", "Demo Rondebosch neighbourhood walking tour", "tourism", -33.9690, 18.4860],
      ["tourism", "Demo garden discovery experience", "tourism", -33.9697, 18.4888],
      ["event", "Demo community arts exhibition", "events", -33.9664, 18.4890],
      ["event", "Demo upcoming weekend craft market", "events", -33.9703, 18.4876],
      ["service", "Demo household plumbing service", "services", -33.9648, 18.4856],
      ["service", "Demo home and office cleaning service", "services", -33.9710, 18.4896],
    ];
    const listings = definitions.map(([kind, title, accountKind, latitude, longitude], index) => {
      const x = { id: randomUUID(), kind, title, accountKind, latitude, longitude, address: "Demo location " + (index + 1) + ", Rondebosch, Cape Town (fictional preview)", revisionId: randomUUID(), permissionId: randomUUID(), reviewId: randomUUID(), authorityReviewId: randomUUID(), locationReviewId: randomUUID(), decisionId: randomUUID(), imageId: randomUUID(), eventIds: Array.from({ length: 4 }, randomUUID) };
      const base = { title, areaId: AREA, address: x.address, latitude, longitude };
      if (kind === "shopping") x.content = { ...base, benefit: index === 2 ? "Demo price: R149 for a sample grocery basket. " + disclaimer : "Demo price: R45 for coffee and a pastry. " + disclaimer, terms: "Preview only. Not redeemable; no real retailer or discount. " + disclaimer, shopName: index === 2 ? "Demo Rondebosch Grocer" : "Demo Rondebosch Cafe", startsAt: iso(-3600000), endsAt: iso(30 * 86400000) };
      if (kind === "tourism" || kind === "event") x.content = { ...base, description: disclaimer + " " + ({ 4: "Sample guided neighbourhood walk, illustrated price R120.", 5: "Sample garden visit, illustrated price R80.", 6: "Sample multi-day arts exhibition; preview admission is free.", 7: "Sample craft market; preview admission is free." })[index], venueName: kind === "tourism" ? "Demo Rondebosch Experiences" : "Demo Community Venue", startsAt: iso(index === 7 ? 7 * 86400000 : -3600000), endsAt: iso(kind === "tourism" ? 30 * 86400000 : index === 7 ? 7 * 86400000 + 6 * 3600000 : 7 * 86400000) };
      if (kind === "service") x.content = { ...base, providerName: index === 8 ? "Demo Rondebosch Plumber" : "Demo Rondebosch Cleaning", serviceType: index === 8 ? "Plumbing" : "Cleaning", description: disclaimer + " " + (index === 8 ? "Example household repairs and maintenance; sample call-out R350." : "Example regular home and office cleaning; sample visit R250."), phone: "+27 00 000 0000" };
      if (kind === "property") {
        x.listingType = index === 0 ? "rent" : "sale";
        x.price = index === 0 ? 12500 : 2450000;
        x.propertyType = index === 0 ? "apartment" : "house";
        x.description = disclaimer + " " + (index === 0 ? "Sample bright furnished apartment: two bedrooms, one bathroom and one parking bay." : "Sample family home: three bedrooms, two bathrooms, a garden and two parking spaces.");
        x.sourceImage = index === 0 ? "C:/Users/BB/.codex/generated_images/01a11b79-b1e6-7451-af92-73e33f8e3c53/exec-8dd876bc-d933-4d87-a526-b5592a76edc4.png" : "C:/Users/BB/.codex/generated_images/01a11b79-b1e6-7451-af92-73e33f8e3c53/exec-56717ee1-36c4-4489-b9f2-01d90164144b.png";
        x.localImage = path.join(directory, index === 0 ? "demo-rental.png" : "demo-sale.png");
        copyFileSync(x.sourceImage, x.localImage);
        x.imagePrompt = index === 0 ? "Fictional Cape Town two-bedroom apartment living room; neutral furnishings, leafy view, daylight; DEMO FICTIONAL PROPERTY label." : "Fictional Cape Town three-bedroom house exterior; cream walls, slate roof, garden, afternoon light; DEMO FICTIONAL PROPERTY label.";
        x.imageGenerator = "built-in image_gen";
      }
      return x;
    });
    const m = { version: 1, batch, project: PROJECT, areaId: AREA, createdAt: new Date(at).toISOString(), provenance, disclaimer, accounts, listings, status: "prepared" };
    validate(m); save(m); console.log("Prepared and schema-validated 5 accounts / 10 listings; no remote writes");
  }
} else if (mode === "accounts-images") {
  requireApply(); const m = load(); validate(m); const client = admin();
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Auth account inventory failed");
    all.push(...data.users); if (data.users.length < 100) break;
    assert.ok(page < 100, "Account inventory bound exceeded");
  }
  for (const a of m.accounts) {
    const found = all.find(u => u.email === a.email);
    if (found) {
      assert.equal(found.user_metadata?.demo_batch, m.batch, "Email collision with an unrelated account");
      if (a.id) assert.equal(a.id, found.id);
      a.id = found.id; save(m); continue;
    }
    assert.equal(a.id, null, "Manifest account is missing remotely");
    const { data, error } = await client.auth.admin.createUser({ email: a.email, password: randomBytes(36).toString("base64url"), email_confirm: true, user_metadata: { full_name: a.name, demo_batch: m.batch, demo_content: true, demo_provenance: provenance } });
    if (error) throw new Error("Demo account creation failed for " + a.kind);
    a.id = data.user.id; save(m); console.log("Created demo " + a.kind + " account");
  }
  for (const x of m.listings.filter(x => x.kind === "property")) {
    const account = m.accounts.find(a => a.kind === x.accountKind);
    x.storagePath = account.id + "/" + x.id + "/demo-" + x.listingType + ".png";
    x.publicImageUrl = URL + "/storage/v1/object/public/listing-images/" + x.storagePath;
    save(m);
    const bytes = readFileSync(x.localImage), digest = createHash("sha256").update(bytes).digest("hex");
    if (x.imageSha256) assert.equal(x.imageSha256, digest);
    if (!x.uploaded) {
      const { error } = await client.storage.from("listing-images").upload(x.storagePath, bytes, { contentType: "image/png", cacheControl: "3600", upsert: false });
      if (error && !/already exists|duplicate/i.test(error.message)) throw new Error("Demo image upload failed");
      const response = await fetch(x.publicImageUrl, { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200);
      assert.equal(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex"), digest);
      x.imageSha256 = digest; x.uploaded = true; save(m);
    }
  }
  if (m.status === "prepared") m.status = "accounts-images-created"; save(m); console.log("5 demo accounts ready; 2 images uploaded and hash-verified");
} else if (mode === "publication-sql") {
  const m = load(); validate(m); assert.ok(m.accounts.every(a => a.id));
  const ids = m.accounts.map(a => q(a.id)).join(",");
  const statements = ["begin;", "set local lock_timeout='5s';", "set local statement_timeout='30s';", "select pg_advisory_xact_lock(hashtext(" + q("pinpoint-demo-" + m.batch) + "));",
    "do $guard$ begin if (select count(*) from auth.users where id in (" + ids + ") and email like 'demo-%-20261008@pinpoint.invalid' and raw_user_meta_data->>'demo_batch'=" + q(m.batch) + ")<>5 then raise exception 'Demo account ownership guard failed'; end if; if exists(select 1 from public.admin_memberships where user_id in (" + ids + ")) then raise exception 'Demo accounts must have no admin membership'; end if; if not exists(select 1 from public.discovery_places where id=" + q(AREA) + " and name='Rondebosch') then raise exception 'Place guard failed'; end if; end $guard$;",
    "update public.notification_subscriptions set enabled=false,frequency='never' where user_id in (" + ids + ") and not(channel=\'in_app\' and category in (\'security\',\'account_updates\'));",
    "update public.profiles set phone=null,phone_verified=false,email_verified_at=null,presence_status='offline',availability_mode='invisible',about=" + q(disclaimer) + " where id in (" + ids + ");"];
  for (const a of m.accounts) statements.push("update public.public_profiles set display_name=" + q(a.name) + " where profile_id=" + q(a.id) + ";");
  const owner = kind => m.accounts.find(a => a.kind === kind).id;
  statements.push("update public.profiles set role='landlord' where id=" + q(owner("property")) + ";");
  statements.push("insert into public.profile_personas(profile_id,persona,is_primary,is_active) values(" + q(owner("property")) + ",'landlord',true,true) on conflict do nothing;");
  statements.push("insert into public.offer_posters(user_id) values(" + q(owner("shopping")) + ") on conflict do nothing;");
  for (const [kind, category] of [["tourism", "tourism"], ["events", "event"]]) statements.push("insert into public.entry_posters(user_id,category) values(" + q(owner(kind)) + "," + q(category) + ") on conflict do nothing;");
  for (const x of m.listings) {
    const user = q(owner(x.accountKind)), id = q(x.id), revision = q(x.revisionId), content = j(x.content);
    // An existing manifest row is never overwritten; publication/verification uses its original IDs.
    if (x.kind === "property") {
      assert.ok(x.uploaded && x.storagePath && x.publicImageUrl);
      const sale = x.listingType === "sale";
      statements.push("insert into public.listings(id,landlord_id,title,price,sale_price,listing_type,address,latitude,longitude,bedrooms,bathrooms,parking_type,parking_count,electricity_type,water_availability,lease_duration,availability_date,description,property_type,electricity_included,water_included,wifi_available,wifi_included,parking_included,status,metadata) values(" + [id, user, q(x.title), x.price, sale ? x.price : "null", q(x.listingType), q(x.address), x.latitude, x.longitude, sale ? 3 : 2, sale ? 2 : 1, "'off_street'", sale ? 2 : 1, "'prepaid'", "'municipal'", sale ? "null" : "'12 months'", q(m.createdAt.slice(0, 10)), q(x.description), q(x.propertyType), "false", "true", "true", "false", "true", "'published'", j({ demo: true, demoBatch: m.batch, demoProvenance: provenance, amenities: { essentials: sale ? ["garden"] : ["furnished"] } })].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.listing_images(id,listing_id,bucket,path,public_url,sort_order) values(" + [q(x.imageId), id, "'listing-images'", q(x.storagePath), q(x.publicImageUrl), 0].join(",") + ") on conflict(id) do nothing;");
    } else if (x.kind === "shopping") {
      statements.push("insert into public.shopping_offers(id,poster_id,draft,version) values(" + [id, user, content, 4].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.shopping_offer_revisions(id,offer_id,poster_id,content) values(" + [revision, id, user, content].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.shopping_offer_permissions(revision_id,offer_id,poster_id,statement_version,statement) values(" + [revision, id, user, "'shop-authorization-v1'", q("I am authorized by this shop to publish this offer and its public address, and the benefit, terms and validity dates are accurate.")].join(",") + ") on conflict(revision_id) do nothing;");
      statements.push("insert into public.shopping_offer_permission_reviews(id,offer_id,revision_id,poster_id,reviewer_id,offer_version,evidence_kind,source_reference,verification_note,statement_version) values(" + [q(x.reviewId), id, revision, user, user, 3, "'written_authorization'", q("demo-manifest:" + m.batch + " / explicit user authorization for fictional samples only"), q(provenance + " Fixed consent/review fields are synthetic fixture scaffolding only; no real shop authorization is represented."), "'admin-permission-review-v1'"].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.shopping_offer_location_reviews(id,offer_id,revision_id,poster_id,reviewer_id,offer_version,permission_review_id,place_id,place_snapshot,provenance_reference,shop_reference,verification_note,statement_version) select " + [q(x.locationReviewId), id, revision, user, user, 3, q(x.reviewId), "p.id", "to_jsonb(p)", q("Existing stored Rondebosch place; synthetic point for demo cards"), q("Fictional shop; no physical retailer or trading offer"), q(provenance), "'admin-location-review-v1'"].join(",") + " from public.discovery_places p where p.id=" + q(AREA) + " on conflict(id) do nothing;");
      statements.push("insert into public.shopping_offer_decisions(id,offer_id,revision_id,poster_id,actor_id,action,captured_version,version,permission_review_id,location_review_id,statement_version) values(" + [q(x.decisionId), id, revision, user, user, "'approve'", 3, 4, q(x.reviewId), q(x.locationReviewId), "'admin-offer-approval-v1'"].join(",") + ") on conflict(id) do nothing;");
      for (let v = 1; v <= 3; v++) statements.push("insert into public.shopping_offer_events(id,poster_id,offer_id,revision_id,actor_id,action,version) values(" + [q(x.eventIds[v - 1]), user, id, v === 3 ? revision : "null", user, q(["create", "save", "submit"][v - 1]), v].join(",") + ") on conflict(id) do nothing;");
    } else if (x.kind === "tourism" || x.kind === "event") {
      const cat = q(x.kind);
      statements.push("insert into public.pinpoint_entries(id,poster_id,category,draft,version) values(" + [id, user, cat, content, 4].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.pinpoint_entry_revisions(id,entry_id,poster_id,category,content) values(" + [revision, id, user, cat, content].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.pinpoint_entry_permissions(id,entry_id,revision_id,poster_id,category) values(" + [q(x.permissionId), id, revision, user, cat].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.pinpoint_entry_publication_reviews(id,authority_review_id,entry_id,revision_id,poster_id,category,permission_id,reviewer_id,captured_version,area_id,place_snapshot,authority_notes,location_notes,media_state) select " + [q(x.reviewId), q(x.authorityReviewId), id, revision, user, cat, q(x.permissionId), user, 3, "p.id", "to_jsonb(p)", q(provenance + " Synthetic fixture consent; no real venue publishing authority asserted."), q("Rondebosch stored place reused. Approximate fictional map point; do not visit."), "'none'"].join(",") + " from public.discovery_places p where p.id=" + q(AREA) + " on conflict(id) do nothing;");
      statements.push("update public.pinpoint_entries set approved_revision_id=" + revision + " where id=" + id + " and poster_id=" + user + " and approved_revision_id is null;");
      statements.push("insert into public.approved_entry_specials(id,revision_id,category,area_id,content) values(" + [id, revision, cat, q(AREA), content].join(",") + ") on conflict(id) do nothing;");
      for (let v = 1; v <= 4; v++) statements.push("insert into public.pinpoint_entry_events(id,poster_id,category,entry_id,revision_id,actor_id,action,version) values(" + [q(x.eventIds[v - 1]), user, cat, id, v >= 3 ? revision : "null", user, q(["create", "save", "submit", "approve"][v - 1]), v].join(",") + ") on conflict(id) do nothing;");
    } else {
      statements.push("insert into public.service_submissions(id,poster_id,draft,submitted,status,version) values(" + [id, user, content, content, "'approved'", 4].join(",") + ") on conflict(id) do nothing;");
      statements.push("insert into public.approved_services(id,area_id,content) values(" + [id, q(AREA), content].join(",") + ") on conflict(id) do nothing;");
      for (let v = 1; v <= 4; v++) statements.push("insert into public.service_submission_events(id,service_id,actor_id,action,version,content,reason) values(" + [q(x.eventIds[v - 1]), id, user, q(["create", "save", "submit", "approve"][v - 1]), v, content, q(provenance)].join(",") + ") on conflict(id) do nothing;");
    }
  }
  statements.push("do $verify$ begin if (select count(*) from public.listings where id in (" + m.listings.filter(x => x.kind === "property").map(x => q(x.id)).join(",") + ") and status='published')<>2 then raise exception 'Property publication count failed'; end if; if exists(select 1 from public.notification_subscriptions where user_id in (" + ids + ") and enabled and not(channel=\'in_app\' and category in (\'security\',\'account_updates\'))) then raise exception 'Demo external and optional notifications must remain disabled'; end if; end $verify$;", "commit;");
  const existingChecks = [
    ["listings", m.listings.filter(x => x.kind === "property")],
    ["shopping_offers", m.listings.filter(x => x.kind === "shopping")],
    ["pinpoint_entries", m.listings.filter(x => x.kind === "tourism" || x.kind === "event")],
    ["service_submissions", m.listings.filter(x => x.kind === "service")],
  ];
  const collisionCount = existingChecks.map(([table, records]) => "(select count(*) from public." + table + " where id in (" + records.map(x => q(x.id)).join(",") + "))").join("+");
  const mutationBlock = statements.splice(5, statements.length - 7);
  statements.splice(5, 0, "do $seed$ declare existing integer; begin select " + collisionCount + " into existing; if existing=10 then return; end if; if existing<>0 then raise exception 'Partial or unrelated fixture collision; no changes applied'; end if;\n" + mutationBlock.join("\n") + "\nend $seed$;");
  const sql = statements.join("\n") + "\n"; writeFileSync(path.join(directory, "publication.sql"), sql); console.log(sql);
} else if (mode === "rollback-sql") {
  const m = load(), group = kind => m.listings.filter(x => x.kind === kind).map(x => q(x.id)).join(",");
  console.log(["begin;", "update public.listings set status='archived' where id in (" + group("property") + ") and metadata->>'demoBatch'=" + q(m.batch) + ";",
    "update public.shopping_offers set withdrawn_at=now(),pending_revision_id=null,version=version+1 where id in (" + group("shopping") + ") and withdrawn_at is null;",
    "update public.pinpoint_entries set withdrawn_at=now(),pending_revision_id=null,approved_revision_id=null,version=version+1 where id in (" + group("tourism") + "," + group("event") + ") and withdrawn_at is null;",
    "delete from public.approved_services where id in (" + group("service") + ");",
    "update public.service_submissions set status='withdrawn',version=version+1 where id in (" + group("service") + ") and status<>'withdrawn';",
    "commit;"].join("\n"));
} else if (mode === "verify-public") {
  const m = load(), results = [];
  async function get(endpoint) {
    const response = await fetch(BASE + endpoint, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, "HTTP failure for " + endpoint);
    return await response.json();
  }
  function record(name, details) { results.push({ name, ...details, passed: true }); }
  for (const kind of ["shopping", "tourism", "event", "service", "property-rent", "property-sale"]) {
    const endpoint = kind === "shopping" ? "/api/offers?areaId=" + AREA : kind === "service" ? "/api/services?areaId=" + AREA : kind.startsWith("property") ? "/api/listings?areaId=" + AREA + "&mode=" + (kind.endsWith("sale") ? "buy" : "rent") : "/api/entries?category=" + kind + "&areaId=" + AREA;
    const body = await get(endpoint); const payload = body.data ?? body;
    const items = payload.items ?? payload.listings ?? (Array.isArray(payload) ? payload : []);
    const expected = m.listings.filter(x => kind.startsWith("property") ? x.kind === "property" && x.listingType === kind.split("-")[1] : x.kind === kind);
    for (const x of expected) assert.ok(items.some(i => (i.id ?? i.offerId ?? i.entryId) === x.id), "Missing demo listing: " + x.title);
    if (!kind.startsWith("property")) assert.equal(payload.totalCount, 2);
    if (kind.startsWith("property")) assert.equal(items.length, 1);
    if (kind === "event") {
      assert.equal(items.find(i => i.entryId === expected[0].id).state, "live");
      assert.equal(items.find(i => i.entryId === expected[1].id).state, "upcoming");
    }
    record(kind + " feed", { endpoint, count: items.length });
  }
  for (const x of m.listings.filter(x => ["shopping", "tourism", "event"].includes(x.kind))) {
    const endpoint = x.kind === "shopping" ? "/api/offers/" + x.id : "/api/entries/" + x.id;
    const body = await get(endpoint);
    assert.ok(JSON.stringify(body).includes(x.title), "Missing demo detail content");
    record(x.kind + " detail", { id: x.id, endpoint });
  }
  for (const x of m.listings.filter(x => x.kind === "property")) {
    const response = await fetch(x.publicImageUrl, { signal: AbortSignal.timeout(30000) }); assert.equal(response.status, 200);
    assert.equal(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex"), x.imageSha256);
    record("Property image", { id: x.id, sha256: x.imageSha256 });
  }
  writeFileSync(path.join(directory, "public-verification.json"), JSON.stringify({ at: new Date().toISOString(), environment: "live Cloudflare HTTP and public Storage", results, passed: true }, null, 2) + "\n");
  m.status = "public-verified"; m.publicVerifiedAt = new Date().toISOString(); save(m);
  console.log(JSON.stringify({ passed: true, checks: results.length, counts: { accounts: 5, listings: 10 } }));
} else { throw new Error("Choose prepare, accounts-images --apply, publication-sql, rollback-sql, or verify-public"); }
