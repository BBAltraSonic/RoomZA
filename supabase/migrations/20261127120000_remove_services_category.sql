-- Removes the Local Services category: provider listings, admin review, service bookings,
-- opening hours and the assistant's "open now" lookup. The app no longer reads or writes any
-- of it. Every shared function that had a services branch is redefined without it.
--
-- This deletes data. Run it only once the app build without Services is live. The
-- 'service_booking_update' value stays in public.notification_type because Postgres cannot
-- drop an enum value in place; nothing emits it any more and its rows are deleted below.
-- Photo files that belonged to services stay in the discovery-media bucket until the storage
-- API removes them; only their database rows are deleted here.

-- 1. Rows that point at services ------------------------------------------------------------
delete from public.notification_events where type = 'service_booking_update';
delete from public.assistant_reminders where service_id is not null;
delete from public.assistant_action_log where service_id is not null or action in ('booking_accepted', 'booking_declined');
delete from private.guest_contact_legacy_publications where category = 'service';
delete from public.discovery_media where category = 'service';

-- 2. Shared functions, without their services branches -------------------------------------
create or replace function private.discovery_media_access(object_path text, upload boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item public.discovery_media%rowtype;
begin
  select * into item from public.discovery_media where path=object_path;
  if item.id is null then return false; end if;
  if upload is not true and private.discovery_media_published(item.id) then return true; end if;
  if not private.pinpoint_intake_eligible() then return false; end if;
  if upload is true then
    return item.owner_id=auth.uid() and not item.ready and case item.category
      when 'shopping' then private.pinpoint_intake_poster()
      else private.pinpoint_entry_active(item.category)
    end;
  end if;
  return item.owner_id=auth.uid()
    or (private.pinpoint_intake_reviewer()
      and private.discovery_media_referenced(item.id));
end;
$function$;

create or replace function private.discovery_media_list(category text, target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.pinpoint_intake_eligible() then
    raise exception 'Active photo account required' using errcode='42501';
  end if;
  if category is null or category not in ('shopping','tourism','event') or target is null then
    raise exception 'Invalid photo target' using errcode='22023';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.path) order by m.created_at),'[]')
    from public.discovery_media m
    where m.category=$1 and coalesce(m.offer_id,m.entry_id)=$2 and m.ready
      and (m.owner_id=auth.uid() or (private.pinpoint_intake_reviewer()
        and private.discovery_media_referenced(m.id))));
end;
$function$;

create or replace function private.discovery_media_published(media uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item public.discovery_media%rowtype; snapshot jsonb;
begin
 select * into item from public.discovery_media where id=media and ready;
 if item.id is null then return false; end if;
 if item.offer_id is not null then snapshot:=private.pinpoint_offer_public_snapshot(item.offer_id,statement_timestamp()); return coalesce(snapshot->>'status'='live' and snapshot->'content'->'mediaIds' @> jsonb_build_array(media::text),false);
 else return exists(select 1 from public.approved_entry_specials a where a.id=item.entry_id and private.pinpoint_entry_public_eligible(a.id) and (a.category='event' or (a.content->>'startsAt')::timestamptz<=statement_timestamp()) and (a.content->>'endsAt')::timestamptz>statement_timestamp() and a.content->'mediaIds' @> jsonb_build_array(media::text)); end if;
end; $function$;

create or replace function private.discovery_media_referenced(media uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.shopping_offer_revisions where content->'mediaIds' @> jsonb_build_array(media::text))
 or exists(select 1 from public.pinpoint_entry_revisions where content->'mediaIds' @> jsonb_build_array(media::text)); $function$;

create or replace function private.discovery_media_scope_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare content jsonb; media_id uuid; card_category text;
begin
 card_category:=case tg_table_name when 'shopping_offers' then 'shopping' else to_jsonb(new)->>'category' end;
 for content in select new.draft loop
  for media_id in select value::uuid from jsonb_array_elements_text(coalesce(content->'mediaIds','[]')) loop
   if not exists(select 1 from public.discovery_media m where m.id=media_id and m.owner_id=new.poster_id and m.category=card_category and coalesce(m.offer_id,m.entry_id)=new.id and m.ready) then raise exception 'Photo must belong to this draft' using errcode='22023'; end if;
  end loop;
 end loop;
 return new;
end; $function$;

create or replace function private.notification_source_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n jsonb; o jsonb:='{}'; target uuid; recipient uuid; actor uuid; listing_ref uuid; applicant uuid;
 parent jsonb; body jsonb; cat public.notification_category; event_type public.notification_type;
 key text; label text; source text; changed boolean; scheduled timestamptz; stamp text; saver record;
begin
 if not private.notification_flag('notifications_event_generation') then return coalesce(new,old); end if;
 if tg_op='DELETE' then n:=to_jsonb(old); else n:=to_jsonb(new); end if;
 if tg_op='UPDATE' then o:=to_jsonb(old); end if;
 if tg_op='DELETE' and tg_table_name not in ('saved_specials','approved_entry_specials') then return old; end if;
 target:=nullif(n->>'id','')::uuid;
 source:=tg_table_name;
 body:=jsonb_build_object('sourceKind',source,'sourceId',target);
 event_type:='interaction_update'; cat:='account_updates'; key:=source||':'||coalesce(target::text,'')||':'||coalesce(n->>'version',n->>'updated_at',n->>'status',tg_op);
 case tg_table_name
 when 'messages' then
  if tg_op='UPDATE' and n->>'read_at' is not null and n->>'read_at' is distinct from o->>'read_at' then
   update public.notification_events set read_at=coalesce(read_at,(n->>'read_at')::timestamptz) where source_kind='message' and source_id=target and recipient_id=coalesce(auth.uid(),recipient_id);
   return new;
  end if;
  if tg_op<>'INSERT' or n->>'system_call_id' is not null then return new; end if;
  select to_jsonb(c) into parent from public.conversations c where c.id=(n->>'conversation_id')::uuid;
  actor:=(n->>'sender_id')::uuid;
  recipient:=case when parent->>'renter_id'=actor::text then (parent->>'landlord_id')::uuid else (parent->>'renter_id')::uuid end;
  if actor::text not in (parent->>'renter_id',parent->>'landlord_id') then return new; end if;
  event_type:='new_message'; cat:='messages'; source:='message'; key:='new_message:'||target;
  body:=jsonb_build_object('message',left(n->>'content',180),'conversationId',n->>'conversation_id','listingId',n->>'listing_id');
  update public.notification_reminder_jobs j set status='cancelled' from public.profile_contact_requests r where j.source_kind='contact' and j.source_id=r.id and j.status='pending' and r.recipient_id=actor and r.requester_id=recipient;
 when 'call_sessions' then
  if tg_op='INSERT' and n->>'status'='ringing' then recipient:=(n->>'callee_id')::uuid; actor:=(n->>'caller_id')::uuid;
   label:='You have an incoming call.'; body:=body||jsonb_build_object('kind','incoming');
  elsif tg_op='UPDATE' and n->>'status' is distinct from o->>'status' and n->>'status' in ('missed','declined') then
   recipient:=(n->>'caller_id')::uuid; actor:=(n->>'callee_id')::uuid; label:=case when n->>'status'='missed' then 'Your call was missed.' else 'Your call was declined.' end;
   body:=body||jsonb_build_object('kind',n->>'status');
  else return new; end if;
  source:='call'; cat:='messages'; event_type:='incoming_call'; key:='incoming_call:'||(n->>'status')||':'||target;
  body:=body||jsonb_build_object('message',label,'conversationId',n->>'conversation_id','listingId',n->>'listing_id');
 when 'profile_contact_requests' then
  if tg_op<>'INSERT' then return new; end if;
  recipient:=(n->>'recipient_id')::uuid; actor:=(n->>'requester_id')::uuid; source:='contact'; cat:='messages';
  body:=body||jsonb_build_object('message',n->>'message','requestId',target,'profileId',actor,'title','Contact request');
  perform private.notification_schedule(recipient,'contact',target,n->>'created_at','contact_followup',
   (n->>'created_at')::timestamptz+interval '1 day',(n->>'created_at')::timestamptz+interval '1 day 5 minutes','messages',
   body||jsonb_build_object('message','A contact request is awaiting your response.'));
 when 'applications' then
  select to_jsonb(l) into parent from public.listings l where l.id=(n->>'listing_id')::uuid;
  listing_ref:=(n->>'listing_id')::uuid; applicant:=(n->>'renter_id')::uuid; cat:='applications'; source:='application';
  if tg_op='INSERT' then
   recipient:=(parent->>'landlord_id')::uuid; actor:=applicant; event_type:='new_application'; key:='new_application:'||target;
   body:=body||jsonb_build_object('message','A new application has been submitted.','applicationId',target,'listingId',listing_ref);
   perform private.notification_enqueue(applicant,'interaction_update','applications',key||':confirmation',body||jsonb_build_object('message','Your application was submitted.'),null,'application',target);
   perform private.notification_schedule(recipient,'application',target,n->>'created_at','application_followup',
    (n->>'created_at')::timestamptz+interval '1 day',(n->>'created_at')::timestamptz+interval '1 day 5 minutes',cat,
    body||jsonb_build_object('message','An application is awaiting your review.'));
  elsif n->>'status' is distinct from o->>'status' then
   update public.notification_reminder_jobs set status='cancelled' where source_kind='application' and source_id=target and status='pending';
   recipient:=case when n->>'status'='withdrawn' then (parent->>'landlord_id')::uuid else applicant end;
   event_type:='application_status_changed'; key:='application_status_changed:'||target||':'||(n->>'status');
   body:=body||jsonb_build_object('message','Application status: '||replace(n->>'status','_',' ')||'.','applicationId',target,'listingId',listing_ref,'status',n->>'status');
  else return new; end if;
 when 'showing_requests' then
  if tg_op='UPDATE' and n->>'status' is not distinct from o->>'status' then return new; end if;
  if n->>'status'='requested' then recipient:=(n->>'landlord_id')::uuid; actor:=(n->>'renter_id')::uuid; event_type:='showing_request';
  elsif n->>'status' in ('accepted','declined') then recipient:=(n->>'renter_id')::uuid; event_type:=('showing_'||(n->>'status'))::public.notification_type;
  elsif n->>'status' in ('cancelled','expired','completed') then
   perform private.notification_enqueue((n->>'landlord_id')::uuid,'interaction_update','viewings',key||':host',
    body||jsonb_build_object('message','Showing '||(n->>'status')||'.','listingId',n->>'listing_id'),null,'showing',target);
   recipient:=(n->>'renter_id')::uuid;
  else return new; end if;
  cat:='viewings'; source:='showing'; key:=event_type::text||':'||target||':'||(n->>'status');
  body:=body||jsonb_build_object('message','Showing '||(n->>'status')||'.','listingId',n->>'listing_id','conversationId',n->>'conversation_id');
 when 'viewings','viewing_slot_offers' then
  select to_jsonb(s) into parent from public.viewing_slots s where s.id=(n->>'slot_id')::uuid;
  listing_ref:=(parent->>'listing_id')::uuid;
  select l.landlord_id into actor from public.listings l where l.id=listing_ref;
  if n->>'application_id' is not null then select renter_id into applicant from public.applications where id=(n->>'application_id')::uuid;
  else select buyer_id into applicant from public.buyer_interests where id=(n->>'buyer_interest_id')::uuid; end if;
  if tg_table_name='viewing_slot_offers' then
   recipient:=applicant; source:='viewing_offer'; cat:='viewings'; event_type:='viewing_proposed';
   stamp:=date_trunc('minute',(n->>'created_at')::timestamptz)::text;
   key:='viewing_proposed:'||listing_ref||':'||applicant||':'||stamp;
   body:=body||jsonb_build_object('message','New viewing times are available.','listingId',listing_ref,'applicationId',n->>'application_id');
   if not exists(select 1 from public.notification_reminder_jobs where recipient_id=recipient and source_kind='viewing_offer' and kind='viewing_followup' and status='pending'
      and payload->>'listingId'=listing_ref::text) then
    perform private.notification_schedule(recipient,source,target,stamp,'viewing_followup',
     (n->>'created_at')::timestamptz+interval '1 day',least((parent->>'start_time')::timestamptz,(n->>'created_at')::timestamptz+interval '1 day 5 minutes'),cat,
     body||jsonb_build_object('message','Please respond to your proposed viewing times.'));
   end if;
  else
   if tg_op='UPDATE' and n->>'status' is not distinct from o->>'status' and n->>'meeting_starts_at' is not distinct from o->>'meeting_starts_at'
      and n->>'slot_id' is not distinct from o->>'slot_id' then return new; end if;
   scheduled:=coalesce((n->>'meeting_starts_at')::timestamptz,(parent->>'start_time')::timestamptz);
   update public.notification_reminder_jobs set status='cancelled' where source_kind='viewing' and source_id=target and status='pending'
     and (source_version is distinct from scheduled::text or n->>'status'<>'booked');
   body:=body||jsonb_build_object('message','Viewing '||(n->>'status')||'.','listingId',listing_ref,'applicationId',n->>'application_id','viewingId',target);
   foreach recipient in array array[actor,applicant] loop
    perform private.notification_enqueue(recipient,case when tg_op='INSERT' then 'viewing_booked'::public.notification_type else 'interaction_update'::public.notification_type end,'viewings',
      'viewing:'||target||':'||recipient||':'||coalesce(scheduled::text,'')||':'||(n->>'status'),body,null,'viewing',target);
    if n->>'status'='booked' then
     perform private.notification_schedule(recipient,'viewing',target,scheduled::text,'viewing_24h',scheduled-interval '1 day',scheduled-interval '1 day'+interval '5 minutes','viewings',
      body||jsonb_build_object('message','Your viewing is tomorrow.'));
     perform private.notification_schedule(recipient,'viewing',target,scheduled::text,'viewing_1h',scheduled-interval '1 hour',scheduled-interval '1 hour'+interval '5 minutes','viewings',
      body||jsonb_build_object('message','Your viewing starts in one hour.'));
    end if;
   end loop;
   return new;
  end if;
 when 'live_tours' then
  if tg_op='UPDATE' and n->>'status' is not distinct from o->>'status' and n->>'scheduled_at' is not distinct from o->>'scheduled_at' then return new; end if;
  update public.notification_reminder_jobs set status='cancelled' where source_kind='tour' and source_id=target and status='pending'
   and (source_version is distinct from (n->>'scheduled_at')::timestamptz::text or n->>'status'<>'scheduled');
  if n->>'status' not in ('live','scheduled','cancelled') then return new; end if;
  event_type:=case n->>'status' when 'live' then 'live_tour_started' when 'scheduled' then 'live_tour_scheduled' else 'interaction_update' end::public.notification_type;
  select to_jsonb(l) into parent from public.listings l where l.id=(n->>'listing_id')::uuid;
  for saver in select user_id from public.user_favorites where listing_id=(n->>'listing_id')::uuid
    union select user_id from public.search_alerts s where s.user_id is not null and s.bounding_box_west<=(parent->>'longitude')::numeric
     and s.bounding_box_east>=(parent->>'longitude')::numeric and s.bounding_box_south<=(parent->>'latitude')::numeric
     and s.bounding_box_north>=(parent->>'latitude')::numeric and private.notification_match_search(parent,coalesce(s.filters,'{}'))
    union select (n->>'host_id')::uuid loop
   body:=jsonb_build_object('message','Live tour '||(n->>'status')||'.','tourId',target,'listingId',n->>'listing_id');
   perform private.notification_enqueue(saver.user_id,event_type,'viewings',event_type::text||':'||target||':'||saver.user_id||':'||coalesce(n->>'scheduled_at',''),body,null,'tour',target);
   if n->>'status'='scheduled' then
    scheduled:=(n->>'scheduled_at')::timestamptz;
    perform private.notification_schedule(saver.user_id,'tour',target,scheduled::text,'tour_15m',scheduled-interval '15 minutes',scheduled-interval '15 minutes'+interval '5 minutes','viewings',
     body||jsonb_build_object('message','Your live tour starts in 15 minutes.'));
   end if;
  end loop;
  return new;
 when 'shopping_offer_events','pinpoint_entry_events','shopping_offer_decisions','pinpoint_entry_corrections','pinpoint_entry_publication_reviews','pinpoint_entry_removals','shopping_offer_permission_reviews','shopping_offer_location_reviews' then
  label:=coalesce(n->>'action',case tg_table_name
    when 'pinpoint_entry_corrections' then 'corrections requested' when 'pinpoint_entry_publication_reviews' then 'approved'
    when 'pinpoint_entry_removals' then 'removed' when 'shopping_offer_permission_reviews' then 'permission verified' when 'shopping_offer_location_reviews' then 'location verified' end);
  if label is null or label in ('enroll','create','save') then return new; end if;
  target:=coalesce((n->>'offer_id')::uuid,(n->>'entry_id')::uuid);
  recipient:=(n->>'poster_id')::uuid;
  if recipient is null and tg_table_name='pinpoint_entry_removals' then select poster_id into recipient from public.pinpoint_entries where id=target; end if;
  if tg_table_name='pinpoint_entry_removals' then perform private.notification_saved_reminders(target,true); end if;
  cat:='offers'; body:=jsonb_build_object('message','Your listing: '||label||'.','title','Listing update',
   'entryId',n->>'entry_id','entryCategory',n->>'category','offerId',n->>'offer_id','reason',left(n->>'reason',400));
  key:='publication:'||tg_table_name||':'||(n->>'id');
 when 'listings' then
  if tg_op='INSERT' then
   if n->>'status'<>'draft' then perform private.notification_enqueue((n->>'landlord_id')::uuid,'interaction_update','offers',key||':owner',jsonb_build_object('message','Property status: '||(n->>'status')||'.','listingId',target,'title','Property update'),null,'listing',target); end if;
   if n->>'status'<>'published' then return new; end if;
  end if;
  if tg_op='UPDATE' and n->>'status' is distinct from o->>'status' then
   perform private.notification_enqueue((n->>'landlord_id')::uuid,'interaction_update','offers',key||':owner',
    jsonb_build_object('message','Property status: '||(n->>'status')||'.','listingId',target,'title','Property update'),null,'listing',target);
  end if;
  changed:=tg_op='UPDATE' and (n->>'status' is distinct from o->>'status' or n->>'price' is distinct from o->>'price'
    or n->>'sale_price' is distinct from o->>'sale_price' or n->>'availability_date' is distinct from o->>'availability_date');
  if changed then
   for saver in select user_id from public.user_favorites where listing_id=target loop
    perform private.notification_enqueue(saver.user_id,'saved_item_update','offers',key||':saved:'||saver.user_id,
      jsonb_build_object('message','Availability, price, or status changed for a home you saved.','listingId',target),null,'saved_listing',target);
   end loop;
  end if;
  if n->>'status'='published' and (tg_op='INSERT' or o->>'status' is distinct from n->>'status' or n->>'price' is distinct from o->>'price' or n->>'sale_price' is distinct from o->>'sale_price' or n->>'bedrooms' is distinct from o->>'bedrooms' or n->>'bathrooms' is distinct from o->>'bathrooms' or n->>'property_type' is distinct from o->>'property_type' or n->>'latitude' is distinct from o->>'latitude' or n->>'longitude' is distinct from o->>'longitude') then
   for saver in select user_id,id from public.search_alerts s where s.user_id is not null and s.user_id<>(n->>'landlord_id')::uuid and coalesce(s.created_at,now())<=now()
    and s.bounding_box_west<=(n->>'longitude')::numeric and s.bounding_box_east>=(n->>'longitude')::numeric
    and s.bounding_box_south<=(n->>'latitude')::numeric and s.bounding_box_north>=(n->>'latitude')::numeric
    and private.notification_match_search(n,coalesce(s.filters,'{}')) and (tg_op='INSERT' or o->>'status'<>'published' or not(coalesce((o->>'longitude')::numeric between s.bounding_box_west and s.bounding_box_east and (o->>'latitude')::numeric between s.bounding_box_south and s.bounding_box_north and private.notification_match_search(o,coalesce(s.filters,'{}')),false))) loop
    perform private.notification_enqueue(saver.user_id,'search_match','saved_searches','search_match:'||target||':'||saver.id||':'||coalesce(n->>'updated_at',pg_catalog.pg_current_xact_id()::text),
      jsonb_build_object('message','A new home matches your saved search.','listingId',target,'searchAlertId',saver.id),null,'search_match',target);
   end loop;
  end if;
  return new;
 when 'saved_specials' then
  if n->>'entry_id' is not null then perform private.notification_saved_reminders((n->>'entry_id')::uuid,true);
  else perform private.notification_saved_reminders((n->>'offer_id')::uuid,false); end if;
  return coalesce(new,old);
 when 'approved_entry_specials','shopping_offers' then
  if tg_table_name='approved_entry_specials' then parent:=n->'content';
  else parent:=private.notification_offer_content(target); end if;
  if tg_op='DELETE' then
   for saver in select user_id from public.saved_specials where entry_id=target loop
    perform private.notification_enqueue(saver.user_id,'saved_item_update','offers',key||':removed:'||saver.user_id,jsonb_build_object('message','An event or Place you saved is no longer available.','entryId',target,'entryCategory',n->>'category'),null,'saved_entry',target);
   end loop;
  end if;
  if tg_op='UPDATE' then
   if tg_table_name='approved_entry_specials' then changed:=parent->>'startsAt' is distinct from o->'content'->>'startsAt' or parent->>'endsAt' is distinct from o->'content'->>'endsAt';
   else changed:=(n->>'withdrawn_at' is distinct from o->>'withdrawn_at') or (n->>'pending_revision_id' is distinct from o->>'pending_revision_id'); end if;
   if changed then
    for saver in select user_id from public.saved_specials where entry_id=target or offer_id=target loop
     perform private.notification_enqueue(saver.user_id,'saved_item_update','offers',key||':saved:'||saver.user_id,
      jsonb_build_object('message','Dates or availability changed for a Special you saved.','entryId',case when tg_table_name='approved_entry_specials' then target else null end,
       'entryCategory',n->>'category','offerId',case when tg_table_name='shopping_offers' then target else null end),null,
       case when tg_table_name='shopping_offers' then 'saved_offer' else 'saved_entry' end,target);
    end loop;
   end if;
  end if;
  perform private.notification_saved_reminders(target,tg_table_name='approved_entry_specials');
  return coalesce(new,old);
 when 'offer_posters','entry_posters' then
  if tg_op<>'UPDATE' or n->>'revoked_at' is not distinct from o->>'revoked_at' then return new; end if;
  recipient:=(n->>'user_id')::uuid;target:=recipient;cat:='account_updates';
  key:='permission:'||tg_table_name||':'||recipient||':'||coalesce(n->>'category','shopping')||':'||coalesce(n->>'revoked_at',o->>'revoked_at')||
    case when n->>'revoked_at' is null then ':restored' else ':revoked' end;
  body:=jsonb_build_object('message',case when n->>'revoked_at' is null then 'Your listing permission was restored.' else 'Your listing permission was revoked.' end,
   'title','Listing permissions','permissionCategory',coalesce(n->>'category','shopping'));
 when 'buyer_interests' then
  if tg_op='UPDATE' and n->>'status' is not distinct from o->>'status' then return new; end if;
  cat:='offers';source:='buyer_interest';target:=(n->>'id')::uuid;
  recipient:=case when tg_op='INSERT' then (n->>'seller_id')::uuid else (n->>'buyer_id')::uuid end;
  actor:=case when tg_op='INSERT' then (n->>'buyer_id')::uuid else null end;
  body:=body||jsonb_build_object('message',case when tg_op='INSERT' then 'You received new purchase interest.' else 'Purchase interest status: '||(n->>'status')||'.' end,
    'listingId',n->>'listing_id','title','Purchase interest');
  if tg_op='INSERT' then perform private.notification_schedule(recipient,'buyer_interest',target,n->>'created_at','buyer_interest_followup',
   (n->>'created_at')::timestamptz+interval '1 day',(n->>'created_at')::timestamptz+interval '1 day 5 minutes',cat,
   body||jsonb_build_object('message','Purchase interest is awaiting your response.')); end if;
 when 'user_favorites' then
  if tg_op='DELETE' then return old; end if;
  for saver in select id,scheduled_at,listing_id from public.live_tours where listing_id=(n->>'listing_id')::uuid and status::text='scheduled' loop
   perform private.notification_schedule((n->>'user_id')::uuid,'tour',saver.id,saver.scheduled_at::text,'tour_15m',
    saver.scheduled_at-interval '15 minutes',saver.scheduled_at-interval '15 minutes'+interval '5 minutes','viewings',
    jsonb_build_object('message','A live tour for a home you saved starts in 15 minutes.','listingId',saver.listing_id,'tourId',saver.id));
  end loop;
  return new;
 when 'viewing_slots' then
  if tg_op<>'UPDATE' or n->>'start_time' is not distinct from o->>'start_time' then return new; end if;
  for saver in select v.id,a.renter_id,b.buyer_id,l.landlord_id from public.viewings v join public.listings l on l.id=(n->>'listing_id')::uuid
   left join public.applications a on a.id=v.application_id left join public.buyer_interests b on b.id=v.buyer_interest_id
   where v.slot_id=target and v.status::text='booked' and v.meeting_starts_at is null loop
   scheduled:=(n->>'start_time')::timestamptz;
   update public.notification_reminder_jobs set status='cancelled' where source_kind='viewing' and source_id=saver.id and status='pending' and source_version<>scheduled::text;
   foreach recipient in array array[saver.landlord_id,coalesce(saver.renter_id,saver.buyer_id)] loop
    body:=jsonb_build_object('message','Your viewing was rescheduled.','listingId',n->>'listing_id','viewingId',saver.id);
    perform private.notification_enqueue(recipient,'interaction_update','viewings','viewing-reschedule:'||saver.id||':'||scheduled||':'||recipient,body,null,'viewing',saver.id);
    perform private.notification_schedule(recipient,'viewing',saver.id,scheduled::text,'viewing_24h',scheduled-interval '1 day',scheduled-interval '1 day'+interval '5 minutes','viewings',body||jsonb_build_object('message','Your viewing is tomorrow.'));
    perform private.notification_schedule(recipient,'viewing',saver.id,scheduled::text,'viewing_1h',scheduled-interval '1 hour',scheduled-interval '1 hour'+interval '5 minutes','viewings',body||jsonb_build_object('message','Your viewing starts in one hour.'));
   end loop;
  end loop;
  return new;
 when 'profile_reviews' then
  if n->>'status'='published' and (tg_op='INSERT' or o->>'status' is distinct from n->>'status') then
   recipient:=(n->>'subject_id')::uuid; actor:=(n->>'reviewer_id')::uuid; cat:='reviews';
   body:=body||jsonb_build_object('message','You received a published review.','title','New review');
  elsif tg_op='UPDATE' and n->>'status' is distinct from o->>'status' and n->>'status' in ('rejected','hidden','removed') then
   recipient:=(n->>'reviewer_id')::uuid; cat:='reviews'; body:=body||jsonb_build_object('message','A moderation decision was made on your review.');
  else return new; end if;
 when 'moderation_cases' then
  if tg_op<>'UPDATE' or n->>'status' is not distinct from o->>'status' then return new; end if;
  if n->>'status' not in ('resolved','dismissed','closed','actioned') then return new; end if;
  recipient:=(n->>'reporter_id')::uuid; body:=body||jsonb_build_object('message','Your report has been reviewed.','title','Report update');
 when 'account_security_events' then
  if not (n->>'is_suspicious')::boolean and n->>'event_key' !~ '(^|[._])(password|email|phone|mfa|session|sessions)([._]|$)' then return new; end if;
  recipient:=(n->>'user_id')::uuid; cat:='security'; body:=body||jsonb_build_object('message','There is an important update to your account security.','title','Security update');
 when 'verification_checks' then
  if tg_op='UPDATE' and n->>'status' is not distinct from o->>'status' then return new; end if;
  if n->>'status' not in ('verified','rejected','revoked','approved') then return new; end if;
  recipient:=(n->>'profile_id')::uuid;
  if recipient is null and n->>'listing_id' is not null then select landlord_id into recipient from public.listings where id=(n->>'listing_id')::uuid; end if;
  cat:='verification'; body:=body||jsonb_build_object('message','Verification status: '||(n->>'status')||'.','title','Verification update');
 when 'organization_invitations' then
  key:=key||':'||pg_catalog.pg_current_xact_id()::text;
  if tg_op='INSERT' then select id into recipient from public.profiles where lower(email)=lower(n->>'email') limit 1; label:='You received an organization invitation.';
  elsif n->>'accepted_at' is distinct from o->>'accepted_at' and n->>'accepted_at' is not null then recipient:=(n->>'invited_by')::uuid; label:='Your organization invitation was accepted.';
  elsif n->>'revoked_at' is distinct from o->>'revoked_at' and n->>'revoked_at' is not null then select id into recipient from public.profiles where lower(email)=lower(n->>'email') limit 1; label:='An organization invitation was revoked.';
  else return new; end if;
  body:=body||jsonb_build_object('message',label,'title','Organization invitation');
 when 'organization_memberships' then
  key:=key||':'||pg_catalog.pg_current_xact_id()::text;
  if tg_op='UPDATE' and n->>'role' is not distinct from o->>'role' and n->>'revoked_at' is not distinct from o->>'revoked_at' then return new; end if;
  recipient:=(n->>'user_id')::uuid; body:=body||jsonb_build_object('message','Your organization membership changed.','title','Organization update');
 else return coalesce(new,old);
 end case;
 body:=body||jsonb_build_object('sourceKind',tg_table_name,'sourceId',target);
 if recipient is not null then perform private.notification_enqueue(recipient,event_type,cat,key,body,actor,source,target); end if;
 if tg_table_name='shopping_offer_decisions' then
  perform private.notification_saved_reminders(target,false);
  for saver in select user_id from public.saved_specials where offer_id=target loop
   perform private.notification_enqueue(saver.user_id,'saved_item_update','offers',key||':saved:'||saver.user_id,jsonb_build_object('message','Availability changed for a Special you saved.','offerId',target),null,'saved_offer',target);
  end loop;
 end if;
 return coalesce(new,old);
end; $function$;

create or replace function private.pinpoint_guest_publication_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare content jsonb; publication_category text; target uuid; exempt boolean;
begin
  if tg_table_name='listings' then
    if tg_op='INSERT' then new.guest_contact_exempt := false;
    elsif new.guest_contact_exempt is distinct from old.guest_contact_exempt then
      raise exception 'Publication exemption is immutable' using errcode='42501';
    end if;
    content := coalesce(new.metadata,'{}'::jsonb);
    perform private.pinpoint_contact_validate(content, false);
    if new.status='published' then
      perform private.pinpoint_contact_validate(content, not new.guest_contact_exempt or coalesce(content->'publicContact','{}'::jsonb)<>'{}'::jsonb);
    end if;
    return new;
  elsif tg_table_name='shopping_offer_decisions' then
    if new.action<>'approve' then return new; end if;
    publication_category := 'shopping'; target := new.offer_id;
    select r.content into content from public.shopping_offer_revisions r where r.id=new.revision_id and r.offer_id=target;
  elsif tg_table_name='approved_entry_specials' then
    publication_category := 'entry'; target := new.id; content := new.content;
  else raise exception 'Unsupported publication table';
  end if;
  select exists(select 1 from private.guest_contact_legacy_publications e where e.category=publication_category and e.listing_id=target) into exempt;
  perform private.pinpoint_contact_validate(content, not exempt or coalesce(content->'publicContact','{}'::jsonb)<>'{}'::jsonb);
  return new;
end;
$function$;

create or replace function public.discovery_card_presentation(targets jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target jsonb; snapshot jsonb; category text; target_id uuid; result jsonb:='[]'; paths jsonb; total bigint;
begin
 if jsonb_typeof(targets) is distinct from 'array' or jsonb_array_length(targets)>250 then raise exception 'Invalid targets' using errcode='22023'; end if;
 for target in select value from jsonb_array_elements(targets) loop
  category:=target->>'category'; target_id:=(target->>'id')::uuid;
  snapshot:=private.discovery_special_snapshot(category,target_id);
  if snapshot is null then continue; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.path) order by v.ordinality),'[]') into paths from jsonb_array_elements_text(coalesce(snapshot->'content'->'mediaIds','[]')) with ordinality v(id,ordinality) join public.discovery_media m on m.id=v.id::uuid and m.ready;
  select count(*) into total from public.saved_specials s where (category='shopping' and s.offer_id=target_id) or (category in ('tourism','event') and s.entry_id=target_id);
  result:=result||jsonb_build_array(jsonb_build_object('id',target_id,'category',category,'media',paths,'savedCount',total));
 end loop; return result;
end; $function$;

create or replace function public.discovery_media_manage(command text, category text, target uuid, expected_version integer DEFAULT NULL::integer, media uuid DEFAULT NULL::uuid, mime text DEFAULT NULL::text, bytes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare subject uuid; version integer; item public.discovery_media%rowtype; new_id uuid; object_path text;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or category not in ('shopping','tourism','event') then raise exception 'Sign in required' using errcode='42501'; end if;
 if category='shopping' then select poster_id,o.version into subject,version from public.shopping_offers o where id=target for update;
 else select poster_id,e.version into subject,version from public.pinpoint_entries e where id=target and e.category=$2 for update; end if;
 if subject is distinct from auth.uid() then raise exception 'Photo owner required' using errcode='42501'; end if;
 if (category='shopping' and not private.pinpoint_offer_poster_eligible(auth.uid())) or (category in ('tourism','event') and not private.pinpoint_entry_active(category)) then raise exception 'Active poster required' using errcode='42501'; end if;
 if command='reserve' then
  if version is distinct from expected_version then raise exception 'Draft changed' using errcode='PT409'; end if;
  if mime not in ('image/jpeg','image/png','image/webp') or bytes is null or bytes not between 1 and 10485760 then raise exception 'Invalid image' using errcode='22023'; end if;
  if (select count(*) from public.discovery_media m where m.owner_id=subject and coalesce(m.offer_id,m.entry_id)=target and not private.discovery_media_referenced(m.id))>=20 then raise exception 'Remove unused draft photos first' using errcode='22023'; end if;
  new_id:=gen_random_uuid(); object_path:=subject::text||'/'||target::text||'/'||new_id::text||case mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
  insert into public.discovery_media(id,owner_id,category,offer_id,entry_id,path,mime_type,bytes) values(new_id,subject,category,case when category='shopping' then target end,case when category in ('tourism','event') then target end,object_path,mime,bytes) returning * into item;
 elsif command in ('complete','delete') then
  select * into item from public.discovery_media m where m.id=media and m.owner_id=subject and m.category=$2 and coalesce(m.offer_id,m.entry_id)=target for update;
  if item.id is null then raise exception 'Photo not found' using errcode='42501'; end if;
  if command='complete' then
   if not exists(select 1 from storage.objects o where o.bucket_id='discovery-media' and o.name=item.path and (o.metadata->>'size')::bigint=item.bytes and o.metadata->>'mimetype'=item.mime_type) then raise exception 'Upload incomplete' using errcode='22023'; end if;
   update public.discovery_media m set ready=true where m.id=item.id;
  else
   if private.discovery_media_referenced(item.id) then raise exception 'Submitted photos are immutable; remove the photo from the next draft instead' using errcode='22023'; end if;
   if exists(select 1 from public.shopping_offers where draft->'mediaIds' @> jsonb_build_array(item.id::text)) or exists(select 1 from public.pinpoint_entries where draft->'mediaIds' @> jsonb_build_array(item.id::text)) then raise exception 'Save the draft without this photo before deleting it' using errcode='22023'; end if;
   delete from public.discovery_media m where m.id=item.id;
  end if;
 else raise exception 'Invalid photo command' using errcode='22023'; end if;
 return jsonb_build_object('id',item.id,'path',item.path);
end; $function$;

drop function public.pinpoint_discovery_viewport(text, double precision, double precision, double precision, double precision, text, text, text);
create function public.pinpoint_discovery_viewport(category text, west double precision, south double precision, east double precision, north double precision, search_query text DEFAULT ''::text, sort_order text DEFAULT 'Ending soon'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb; at_time timestamptz := statement_timestamp();
begin
  if (category in ('shopping','tourism','event')
      and west between -180 and 180 and east between -180 and 180 and south between -85 and 85
      and north between -85 and 85 and west<east and south<north
      and search_query is not null and length(search_query)<=120
      and sort_order in ('Ending soon','Latest','Nearest')) is not true then
    raise exception 'Valid category and viewport required' using errcode='22023';
  end if;
  if category='shopping' then return public.pinpoint_shopping_viewport(west,south,east,north,search_query,sort_order); end if;
  with candidates as materialized (
    select a.id,a.approved_at,(a.content->>'endsAt')::timestamptz as ends_at,a.content,
      jsonb_build_object('entryId',a.id,'category',a.category,'content',a.content,'approvedAt',a.approved_at,
        'state',case when (a.content->>'startsAt')::timestamptz>at_time then 'upcoming' else 'live' end) as item,
      concat_ws(' ',a.content->>'title',a.content->>'venueName',a.content->>'description',a.content->>'address') as searchable
    from public.approved_entry_specials a where $1 in ('tourism','event') and a.category=$1
      and (a.content->>'longitude')::double precision between west and east
      and (a.content->>'latitude')::double precision between south and north
  ), eligible as materialized (
    select * from candidates where strpos(lower(searchable),lower(trim(search_query)))>0
  ), ordered as (
    select *,row_number() over (order by
      case when sort_order='Ending soon' then ends_at end asc,
      case when sort_order='Latest' then approved_at end desc,
      case when sort_order='Nearest' then
        power(sin(radians(((content->>'latitude')::double precision-(south+north)/2)/2)),2)
        +cos(radians((south+north)/2))*cos(radians((content->>'latitude')::double precision))
        *power(sin(radians(((content->>'longitude')::double precision-(west+east)/2)/2)),2) end asc,
      id asc) as position from eligible
  ) select jsonb_build_object('category',category,'bounds',jsonb_build_object('west',west,'south',south,'east',east,'north',north),
      'serverNow',at_time,'totalCount',(select count(*) from eligible),
      'items',coalesce((select jsonb_agg(item order by position) from ordered where position<=250),'[]'::jsonb)) into result;
  return result;
end;
$function$;

revoke all on function public.pinpoint_discovery_viewport(text, double precision, double precision, double precision, double precision, text, text) from public;
grant execute on function public.pinpoint_discovery_viewport(text, double precision, double precision, double precision, double precision, text, text) to anon, authenticated;

-- 3. Assistant reminders and approvals log: listings only ------------------------------------
drop policy "Listers and their organisation read the approvals log" on public.assistant_action_log;
drop policy "Only people who can act on the listing log an approval" on public.assistant_action_log;

alter table public.assistant_reminders drop constraint assistant_reminders_one_subject;
alter table public.assistant_reminders drop constraint assistant_reminders_person_has_subject;
alter table public.assistant_reminders drop column subject_key;
alter table public.assistant_reminders drop column service_id;
alter table public.assistant_reminders add column subject_key text generated always as (
  case when customer_id is not null then customer_id::text || ':' || listing_id::text end
) stored;
alter table public.assistant_reminders add constraint assistant_reminders_person_has_subject
  check (customer_id is null or listing_id is not null);
revoke insert on table public.assistant_reminders from authenticated;
grant insert (note, due_at, customer_id, listing_id) on table public.assistant_reminders to authenticated;

alter table public.assistant_action_log drop constraint assistant_action_log_one_subject;
alter table public.assistant_action_log drop constraint assistant_action_log_action_check;
drop index public.assistant_action_log_subject_idx;
drop index public.assistant_action_log_service_idx;
alter table public.assistant_action_log drop column subject_key;
alter table public.assistant_action_log drop column service_id;
alter table public.assistant_action_log alter column listing_id set not null;
alter table public.assistant_action_log add column subject_key text
  generated always as (customer_id::text || ':' || listing_id::text) stored;
alter table public.assistant_action_log add constraint assistant_action_log_action_check check (action in (
  'viewing_accepted', 'viewing_declined', 'application_under_review', 'application_shortlisted',
  'application_approved', 'application_rejected', 'archived', 'unarchived'
));
create index assistant_action_log_subject_idx on public.assistant_action_log(subject_key, created_at desc);
revoke insert on table public.assistant_action_log from authenticated;
grant insert (customer_id, listing_id, action) on table public.assistant_action_log to authenticated;

create policy "Listers and their organisation read the approvals log" on public.assistant_action_log
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (
      organization_id is not null
      and private.has_organization_role(organization_id, array['owner', 'admin', 'agent']::public.organization_role[])
    )
    or private.can_manage_listing(listing_id)
  );

create policy "Only people who can act on the listing log an approval" on public.assistant_action_log
  for insert to authenticated with check (
    actor_id = (select auth.uid()) and private.can_manage_listing(listing_id)
  );

-- 4. Photos and guest contacts: no services category ------------------------------------------
alter table public.discovery_media drop constraint discovery_media_check;
alter table public.discovery_media drop constraint discovery_media_check1;
alter table public.discovery_media drop constraint discovery_media_category_check;
alter table public.discovery_media drop column service_id;
alter table public.discovery_media add constraint discovery_media_category_check
  check (category in ('shopping', 'tourism', 'event'));
alter table public.discovery_media add constraint discovery_media_check
  check (num_nonnulls(offer_id, entry_id) = 1);
alter table public.discovery_media add constraint discovery_media_check1
  check ((category = 'shopping' and offer_id is not null) or (category in ('tourism', 'event') and entry_id is not null));

alter table private.guest_contact_legacy_publications drop constraint guest_contact_legacy_publications_category_check;
alter table private.guest_contact_legacy_publications add constraint guest_contact_legacy_publications_category_check
  check (category in ('shopping', 'entry'));

-- 5. The services schema itself --------------------------------------------------------------
drop function public.services_open_now(uuid[]);
drop function public.respond_service_booking(uuid, text);
drop function public.request_service_booking(uuid, timestamptz, text, text);
drop function public.service_booking_availability(uuid);
drop function public.set_service_hours(uuid, jsonb);
drop function private.service_bookable(uuid, uuid);
drop function private.service_open_slots(uuid, timestamptz, integer);
drop function private.sweep_service_bookings(uuid);
drop table public.service_bookings;
drop table public.service_hours;

drop function public.pinpoint_service_decide(uuid, integer, text, text, text);
drop function public.pinpoint_service_review_queue();
drop function public.pinpoint_service_write(text, uuid, integer, jsonb, boolean);
drop table public.service_submission_events;
drop table public.approved_services;
drop table public.service_submissions;
drop function private.pinpoint_service_decide(uuid, integer, text, text, text);
drop function private.pinpoint_service_review_queue();
drop function private.pinpoint_service_write(text, uuid, integer, jsonb, boolean);
drop function private.pinpoint_service_history_immutable();
drop function private.pinpoint_service_visible(uuid);
drop function private.pinpoint_service_content(jsonb, boolean);
drop function private.pinpoint_service_reviewer();
drop function private.pinpoint_service_eligible();
drop function private.can_manage_service(uuid, uuid);
