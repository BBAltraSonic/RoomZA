-- Preserve existing notification and email history. New transport state is independent.
alter table public.notification_events
  add column category public.notification_category,
  add column actor_id uuid references public.profiles(id) on delete set null,
  add column source_kind text,
  add column source_id uuid,
  add column archived_at timestamptz,
  add column payload_version integer not null default 1,
  add column in_app_visible boolean not null default true;
do $backfill$
declare prior_mode "char";
begin
 select tgenabled into prior_mode from pg_trigger where tgrelid='public.notification_events'::regclass and tgname='notification_events_profile_activity';
 if prior_mode is not null and prior_mode<>'D' then alter table public.notification_events disable trigger notification_events_profile_activity; end if;
 update public.notification_events set category=case
  when type::text in ('new_message','incoming_call') then 'messages'
  when type::text like '%application%' then 'applications'
  when type::text ~ 'viewing|showing|tour' then 'viewings'
  when type::text='profile_document_expiry' then 'verification'
  when type::text='admin_alert' then 'security'
  else 'account_updates' end::public.notification_category;
 if prior_mode='O' then alter table public.notification_events enable trigger notification_events_profile_activity;
 elsif prior_mode='A' then alter table public.notification_events enable always trigger notification_events_profile_activity;
 elsif prior_mode='R' then alter table public.notification_events enable replica trigger notification_events_profile_activity; end if;
end; $backfill$;
alter table public.notification_events alter column category set default 'account_updates';
alter table public.notification_events alter column category set not null;
create index notification_inbox_cursor_idx on public.notification_events(recipient_id,created_at desc,id desc)
  where archived_at is null and in_app_visible;
-- Clients can change inbox state only, never recipient, content, or delivery state.
revoke insert on public.notification_events from public,anon,authenticated;
revoke update on public.notification_events from public,anon,authenticated;
grant update(read_at,archived_at) on public.notification_events to authenticated;

insert into public.app_feature_flags(key,enabled,description) values
 ('notifications_inbox',true,'Live notification inbox and read state.'),
 ('notifications_event_generation',false,'Transactional event producers; enable after controlled validation.'),
 ('notifications_reminders',false,'Limited automatic reminders.'),
 ('notifications_push',false,'Opt-in device push delivery.')
on conflict(key) do nothing;

create table public.notification_options(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 previews boolean not null default true,
 quiet_enabled boolean not null default false,
 quiet_start time not null default '21:00',
 quiet_end time not null default '08:00',
 timezone text not null default 'Africa/Johannesburg',
 check(not quiet_enabled or quiet_start <> quiet_end)
);
create table public.notification_push_devices(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 endpoint text not null unique check(char_length(endpoint) <= 2048),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'),
 auth_key text not null check(auth_key ~ '^[A-Za-z0-9_-]{22}$'),
 label text not null check(char_length(label) between 1 and 80),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index notification_devices_owner_idx on public.notification_push_devices(user_id) where revoked_at is null;
create table public.notification_reminder_jobs(
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 source_kind text not null,
 source_id uuid not null,
 source_version text not null,
 kind text not null,
 due_at timestamptz not null,
 expires_at timestamptz not null,
 payload jsonb not null,
 category public.notification_category not null,
 status text not null default 'pending' check(status in ('pending','sent','cancelled','expired')),
 created_at timestamptz not null default now(),
 unique(recipient_id,source_kind,source_id,source_version,kind)
);
create index notification_reminders_due_idx on public.notification_reminder_jobs(due_at) where status='pending';
create table public.notification_push_deliveries(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.notification_events(id) on delete cascade,
 device_id uuid not null references public.notification_push_devices(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','skipped')),
 attempt_count integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 last_error text,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 unique(event_id,device_id)
);
create index notification_push_due_idx on public.notification_push_deliveries(next_attempt_at) where status in ('pending','sending');
alter table public.notification_options enable row level security;
alter table public.notification_push_devices enable row level security;
alter table public.notification_reminder_jobs enable row level security;
alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_options,public.notification_push_devices,public.notification_reminder_jobs,public.notification_push_deliveries from public,anon,authenticated;
grant all on public.notification_options,public.notification_push_devices,public.notification_reminder_jobs,public.notification_push_deliveries to service_role;
grant select,insert,update on public.notification_options to authenticated;
-- Device endpoint and encryption keys are never exposed through the Data API.
create policy "Own notification options" on public.notification_options to authenticated
 using(user_id=(select auth.uid()) and public.is_current_account_active())
 with check(user_id=(select auth.uid()) and public.is_current_account_active());

create function public.notification_access() returns boolean language sql stable security definer set search_path='' as $$
 select public.pinpoint_active_session(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
$$;
revoke all on function public.notification_access() from public,anon;
grant execute on function public.notification_access() to authenticated,service_role;

create function private.notification_flag(flag text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from public.app_feature_flags where key=flag),false);
$$;
create function private.notification_eligible(recipient uuid,actor uuid default null) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=recipient and not coalesce(u.is_anonymous,false)
   and (u.banned_until is null or u.banned_until <= now()))
 and not exists(select 1 from public.account_suspensions s where s.user_id=recipient and s.restored_at is null
   and (s.suspended_until is null or s.suspended_until > now()))
 and (actor is null or (actor<>recipient
   and not exists(select 1 from public.profile_blocks b where (b.blocker_id=recipient and b.blocked_id=actor) or (b.blocker_id=actor and b.blocked_id=recipient))
   and not exists(select 1 from public.profile_mutes m where m.muter_id=recipient and m.muted_id=actor)));
$$;
create function private.notification_prepare() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=new.recipient_id and not coalesce(is_anonymous,false)) then return null; end if;
 if new.category='account_updates' then
   new.category := case
    when new.type::text in ('new_message','incoming_call') then 'messages'
    when new.type::text like '%application%' then 'applications'
    when new.type::text ~ 'viewing|showing|tour' then 'viewings'
    when new.type::text='profile_document_expiry' then 'verification'
    when new.type::text='admin_alert' then 'security'
    when new.type::text='search_match' then 'saved_searches'
    when new.type::text='saved_item_update' then 'offers'
    else 'account_updates' end::public.notification_category;
 end if;
 if new.category not in ('security','account_updates') and not private.notification_eligible(new.recipient_id,new.actor_id) then return null; end if;
 new.in_app_visible := new.category in ('security','account_updates') or coalesce((select enabled and frequency<>'never'
   from public.notification_subscriptions where user_id=new.recipient_id and category=new.category and channel='in_app'),true);
 return new;
end; $$;
create trigger notification_prepare before insert on public.notification_events for each row execute function private.notification_prepare();

create function private.notification_enqueue(recipient uuid,event_type public.notification_type,cat public.notification_category,
 unique_key text,body jsonb,actor uuid default null,source text default null,target uuid default null)
 returns uuid language plpgsql security definer set search_path='' as $$
declare event_id uuid; sender_name text;
begin
 if actor is not null then sender_name:=private.notification_actor_label(actor); if sender_name is not null then body:=body||jsonb_build_object('senderName',sender_name,'senderUsername',(select username from public.public_profiles where profile_id=actor)); end if; end if;
 insert into public.notification_events(recipient_id,type,category,idempotency_key,payload,actor_id,source_kind,source_id)
 values(recipient,event_type,cat,unique_key,body,actor,source,target)
 on conflict(idempotency_key) do nothing returning id into event_id;
 return event_id;
end; $$;

create function private.notification_push_enqueue() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.notification_flag('notifications_push') then
  insert into public.notification_push_deliveries(event_id,device_id)
  select new.id,d.id from public.notification_push_devices d
  where d.user_id=new.recipient_id and d.revoked_at is null and d.created_at <= new.created_at
  on conflict do nothing;
 end if;
 return new;
end; $$;
create trigger notification_push_enqueue after insert on public.notification_events for each row execute function private.notification_push_enqueue();

create function public.notification_update_state(action text,target uuid default null,through timestamptz default null)
 returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if not public.notification_access() then raise exception 'Account access required' using errcode='42501'; end if;
 if action='read' then
  update public.notification_events set read_at=coalesce(read_at,now()) where id=target and recipient_id=auth.uid();
 elsif action='archive' then
  update public.notification_events set archived_at=coalesce(archived_at,now()) where id=target and recipient_id=auth.uid();
 elsif action='read_all' and through is not null and through<=now()+interval '1 minute' then
  update public.notification_events set read_at=now() where recipient_id=auth.uid() and read_at is null and archived_at is null and in_app_visible and created_at<=through;
 else raise exception 'Invalid notification action' using errcode='22023'; end if;
 get diagnostics changed=row_count;
 return changed;
end; $$;
revoke all on function public.notification_update_state(text,uuid,timestamptz) from public,anon;
grant execute on function public.notification_update_state(text,uuid,timestamptz) to authenticated;

create function public.notification_device_manage(command text,device uuid default null,subscription jsonb default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; device_id uuid; push_endpoint text;
begin
 if not public.notification_access() then raise exception 'Account access required' using errcode='42501'; end if;
 if command='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'createdAt',created_at)),'[]') into result
  from public.notification_push_devices where user_id=auth.uid() and revoked_at is null;
  return result;
 elsif command='remove' then
  update public.notification_push_devices set revoked_at=now() where id=device and user_id=auth.uid();
  return jsonb_build_object('removed',found);
 elsif command='register' then
  if not private.notification_flag('notifications_push') then raise exception 'Push is not enabled' using errcode='22023'; end if;
  push_endpoint := subscription->>'endpoint';
  if push_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-zA-Z0-9-]+[.])*push[.]apple[.]com|([a-zA-Z0-9-]+[.])*notify[.]windows[.]com)/[^#]*$' then
   raise exception 'Unsupported push endpoint' using errcode='22023'; end if;
  if (select count(*) from public.notification_push_devices where user_id=auth.uid() and revoked_at is null)>=10
     and not exists(select 1 from public.notification_push_devices where endpoint=subscription->>'endpoint' and user_id=auth.uid()) then
   raise exception 'Device limit reached' using errcode='22023'; end if;
  -- An endpoint may be rebound only by its current owner or after its old session expires.
  insert into public.notification_push_devices(user_id,session_id,endpoint,p256dh,auth_key,label)
  values(auth.uid(),(auth.jwt()->>'session_id')::uuid,push_endpoint,subscription->'keys'->>'p256dh',subscription->'keys'->>'auth',subscription->>'label')
  on conflict(endpoint) do update set user_id=excluded.user_id,session_id=excluded.session_id,p256dh=excluded.p256dh,
    auth_key=excluded.auth_key,label=excluded.label,revoked_at=null,created_at=now()
  where notification_push_devices.user_id=auth.uid() or (notification_push_devices.p256dh=excluded.p256dh and notification_push_devices.auth_key=excluded.auth_key) or notification_push_devices.revoked_at is not null
    or not public.pinpoint_active_session(notification_push_devices.user_id,notification_push_devices.session_id)
  returning id into device_id;
  if device_id is null then raise exception 'Device belongs to another active account' using errcode='42501'; end if;
  return jsonb_build_object('id',device_id);
 else raise exception 'Invalid device action' using errcode='22023'; end if;
end; $$;
revoke all on function public.notification_device_manage(text,uuid,jsonb) from public,anon;
grant execute on function public.notification_device_manage(text,uuid,jsonb) to authenticated;

-- Normalized subscriptions are authoritative. Map legacy booleans only where absent.
insert into public.notification_subscriptions(user_id,category,channel,enabled,frequency)
select p.user_id,v.category::public.notification_category,'in_app',v.enabled,'instant'
from public.notification_preferences p cross join lateral(values
 ('messages',p.message_digest),('applications',p.application_updates),('viewings',p.viewing_updates),('saved_searches',p.search_alerts)) v(category,enabled)
on conflict do nothing;
-- Push categories are preferences, not permission: no delivery exists before device consent.
insert into public.notification_subscriptions(user_id,category,channel,enabled,frequency)
select p.id,c,'push',true,'instant' from public.profiles p
cross join unnest(enum_range(null::public.notification_category)) c
where c not in ('marketing','blog_updates') on conflict do nothing;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification_events') then
  alter publication supabase_realtime add table public.notification_events;
 end if;
end $$;

alter table public.profile_contact_requests add column handled_at timestamptz;
create function public.notification_handle_contact(target uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.notification_access() then raise exception 'Account access required' using errcode='42501'; end if;
 update public.profile_contact_requests set handled_at=coalesce(handled_at,now()) where id=target and recipient_id=auth.uid();
 if not found then return false; end if;
 update public.notification_reminder_jobs set status='cancelled' where source_kind='contact' and source_id=target and recipient_id=auth.uid() and status='pending';
 update public.notification_events set read_at=coalesce(read_at,now()) where source_kind='contact' and source_id=target and recipient_id=auth.uid();
 return true;
end; $$;
revoke all on function public.notification_handle_contact(uuid) from public,anon;
grant execute on function public.notification_handle_contact(uuid) to authenticated;

create function private.notification_schedule(recipient uuid,source text,target uuid,version text,reminder_kind text,
 due timestamptz,expiry timestamptz,cat public.notification_category,body jsonb)
 returns void language plpgsql security definer set search_path='' as $$
begin
 -- Never create already-overdue jobs. A short dispatch grace expires missed jobs.
 if due>now() and expiry>due and private.notification_eligible(recipient) then
  insert into public.notification_reminder_jobs(recipient_id,source_kind,source_id,source_version,kind,due_at,expires_at,category,payload)
  values(recipient,source,target,version,reminder_kind,due,expiry,cat,body) on conflict(recipient_id,source_kind,source_id,source_version,kind) do update set status='pending',due_at=excluded.due_at,expires_at=excluded.expires_at,payload=excluded.payload where notification_reminder_jobs.status='cancelled' and excluded.due_at>now();
 end if;
end; $$;

create function private.notification_reminder_valid(job public.notification_reminder_jobs)
 returns boolean language plpgsql stable security definer set search_path='' as $$
declare item jsonb; scheduled timestamptz;
begin
 if not private.notification_eligible(job.recipient_id) then return false; end if;
 case job.source_kind
 when 'buyer_interest' then
  return exists(select 1 from public.buyer_interests b where b.id=job.source_id and b.status::text='interested' and b.seller_id=job.recipient_id and private.notification_eligible(b.seller_id,b.buyer_id));
 when 'application' then
  return exists(select 1 from public.applications a join public.listings l on l.id=a.listing_id
    where a.id=job.source_id and a.status::text='submitted' and l.landlord_id=job.recipient_id and private.notification_eligible(job.recipient_id,a.renter_id));
 when 'contact' then
  return exists(select 1 from public.profile_contact_requests r where r.id=job.source_id and r.recipient_id=job.recipient_id and r.handled_at is null
    and private.notification_eligible(r.recipient_id,r.requester_id)
    and not exists(select 1 from public.conversations c join public.messages m on m.conversation_id=c.id
      where m.sender_id=r.recipient_id and m.created_at>r.created_at and
      ((c.renter_id=r.requester_id and c.landlord_id=r.recipient_id) or (c.landlord_id=r.requester_id and c.renter_id=r.recipient_id))));
 when 'viewing' then
  select coalesce(v.meeting_starts_at,s.start_time) into scheduled from public.viewings v join public.viewing_slots s on s.id=v.slot_id
   where v.id=job.source_id and v.status::text='booked';
  return scheduled is not null and scheduled::text=job.source_version and scheduled>now() and exists(select 1 from public.viewings v join public.viewing_slots s on s.id=v.slot_id join public.listings l on l.id=s.listing_id left join public.applications a on a.id=v.application_id left join public.buyer_interests b on b.id=v.buyer_interest_id where v.id=job.source_id and job.recipient_id in (l.landlord_id,a.renter_id,b.buyer_id));
 when 'viewing_offer' then
  return exists(select 1 from public.viewing_slot_offers o join public.viewing_slots s on s.id=o.slot_id
   where o.id=job.source_id and s.start_time>now() and not exists(select 1 from public.viewings v where (v.application_id=o.application_id or v.buyer_interest_id=o.buyer_interest_id) and v.status::text='booked'));
 when 'tour' then
  return exists(select 1 from public.live_tours t where t.id=job.source_id and t.status::text='scheduled'
   and t.scheduled_at::text=job.source_version and t.scheduled_at>now()
   and (t.host_id=job.recipient_id or exists(select 1 from public.user_favorites f where f.listing_id=t.listing_id and f.user_id=job.recipient_id) or exists(select 1 from public.search_alerts a join public.listings l on l.id=t.listing_id where a.user_id=job.recipient_id and l.longitude between a.bounding_box_west and a.bounding_box_east and l.latitude between a.bounding_box_south and a.bounding_box_north and private.notification_match_search(to_jsonb(l),coalesce(a.filters,'{}')))));
 when 'entry' then
  select a.content into item from public.approved_entry_specials a join public.saved_specials s on s.entry_id=a.id
   where a.id=job.source_id and s.user_id=job.recipient_id;
  return item is not null and coalesce(item->>case when job.kind='event_start' then 'startsAt' else 'endsAt' end,'')=job.source_version
   and (item->>'endsAt')::timestamptz>now();
 when 'offer' then
  select private.notification_offer_content(job.source_id) into item where exists(select 1 from public.saved_specials where offer_id=job.source_id and user_id=job.recipient_id);
  return item is not null and item->>'endsAt'=job.source_version and (item->>'endsAt')::timestamptz>now();
 else return false;
 end case;
end; $$;

create function public.notifications_process_reminders(batch_size integer default 100)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.notification_reminder_jobs; event_id uuid; processed integer:=0; cancelled integer:=0;
begin
 if not private.notification_flag('notifications_reminders') then return jsonb_build_object('processed',0,'cancelled',0); end if;
 for job in select * from public.notification_reminder_jobs where status='pending' and due_at<=now()
   order by due_at limit greatest(1,least(batch_size,200)) for update skip locked loop
  if job.expires_at<=now() then
   update public.notification_reminder_jobs set status='expired' where id=job.id; cancelled:=cancelled+1;
  elsif not private.notification_reminder_valid(job) then
   update public.notification_reminder_jobs set status='cancelled' where id=job.id; cancelled:=cancelled+1;
  else
   event_id:=private.notification_enqueue(job.recipient_id,'automatic_reminder',job.category,'reminder:'||job.id,
     job.payload||jsonb_build_object('reminderId',job.id,'reminderKind',job.kind),null,'reminder',job.id);
   update public.notification_reminder_jobs set status='sent' where id=job.id;
   processed:=processed+1;
  end if;
 end loop;
 return jsonb_build_object('processed',processed,'cancelled',cancelled);
end; $$;

create function private.notification_delivery_allowed(event public.notification_events,device public.notification_push_devices)
 returns boolean language plpgsql stable security definer set search_path='' as $$
declare job public.notification_reminder_jobs;
begin
 if device.user_id<>event.recipient_id or device.revoked_at is not null or device.created_at>event.created_at
   or not public.pinpoint_active_session(device.user_id,device.session_id)
   or not private.notification_eligible(event.recipient_id,event.actor_id)
   or event.archived_at is not null or event.read_at is not null then return false; end if;
 if not coalesce((select enabled and frequency<>'never' from public.notification_subscriptions
    where user_id=event.recipient_id and category=event.category and channel='push'),true) then return false; end if;
 if event.type::text='profile_document_expiry' then
  return exists(select 1 from public.profile_documents d where d.id=(event.payload->>'documentId')::uuid and d.owner_id=event.recipient_id and d.deleted_at is null and d.expires_at::text=event.payload->>'expiresAt');
 elsif event.source_kind='tour' then
  return exists(select 1 from public.live_tours t where t.id=event.source_id and (t.status::text in ('live','scheduled') or (t.status::text='cancelled' and event.type::text='interaction_update')) and
   (t.host_id=event.recipient_id or exists(select 1 from public.user_favorites f where f.listing_id=t.listing_id and f.user_id=event.recipient_id)
    or exists(select 1 from public.search_alerts a join public.listings l on l.id=t.listing_id where a.user_id=event.recipient_id and l.longitude between a.bounding_box_west and a.bounding_box_east and l.latitude between a.bounding_box_south and a.bounding_box_north and private.notification_match_search(to_jsonb(l),coalesce(a.filters,'{}')))));
 elsif event.source_kind='reminder' then
  select * into job from public.notification_reminder_jobs where id=event.source_id;
  return found and job.expires_at>now() and private.notification_reminder_valid(job);
 elsif event.type::text='incoming_call' and event.payload->>'kind'='incoming' then
  return exists(select 1 from public.call_sessions c where c.id=event.source_id and c.status::text='ringing');
 elsif event.source_kind='message' then
  return exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
   where m.id=event.source_id and m.read_at is null and event.recipient_id in (c.renter_id,c.landlord_id));
 elsif event.source_kind='contact' then
  return exists(select 1 from public.profile_contact_requests where id=event.source_id and recipient_id=event.recipient_id and handled_at is null);
 elsif event.source_kind='saved_listing' then
  return exists(select 1 from public.user_favorites where listing_id=event.source_id and user_id=event.recipient_id);
 elsif event.source_kind='saved_entry' then
  return exists(select 1 from public.saved_specials where entry_id=event.source_id and user_id=event.recipient_id);
 elsif event.source_kind='saved_offer' then
  return exists(select 1 from public.saved_specials where offer_id=event.source_id and user_id=event.recipient_id);
 end if;
 return true;
end; $$;

create function public.notifications_claim_push(batch_size integer default 50) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare delivery public.notification_push_deliveries; event public.notification_events; device public.notification_push_devices;
 options public.notification_options; local_time time; result jsonb:='[]'; frequency text; next_due timestamptz;
begin
 if not private.notification_flag('notifications_push') then return result; end if;
 for delivery in select * from public.notification_push_deliveries
  where (status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<=now())
  order by next_attempt_at limit greatest(1,least(batch_size,100)) for update skip locked loop
  if delivery.attempt_count>=5 then
   update public.notification_push_deliveries set status='failed',lease_token=null,lease_until=null,last_error='lease_exhausted' where id=delivery.id; continue;
  end if;
  select * into event from public.notification_events where id=delivery.event_id;
  select * into device from public.notification_push_devices where id=delivery.device_id;
  if not private.notification_delivery_allowed(event,device) or event.created_at<now()-interval '8 days' then
   update public.notification_push_deliveries set status='skipped',lease_token=null,lease_until=null where id=delivery.id;
   continue;
  end if;
  select * into options from public.notification_options where user_id=event.recipient_id;
  if options.quiet_enabled then
   local_time:=(now() at time zone options.timezone)::time;
   if (options.quiet_start<options.quiet_end and local_time>=options.quiet_start and local_time<options.quiet_end)
      or (options.quiet_start>options.quiet_end and (local_time>=options.quiet_start or local_time<options.quiet_end)) then
    update public.notification_push_deliveries set status='pending',next_attempt_at=now()+interval '5 minutes',lease_token=null,lease_until=null where id=delivery.id;
    continue;
   end if;
  end if;
  select s.frequency::text into frequency from public.notification_subscriptions s where s.user_id=event.recipient_id and s.category=event.category and s.channel='push';
  next_due:=event.created_at+case frequency when 'hourly' then interval '1 hour' when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '0' end;
  if next_due>now() then
   update public.notification_push_deliveries set status='pending',next_attempt_at=next_due,lease_token=null,lease_until=null where id=delivery.id;
   continue;
  end if;
  update public.notification_push_deliveries set status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
    attempt_count=attempt_count+1 where id=delivery.id returning * into delivery;
  result:=result||jsonb_build_array(jsonb_build_object('id',delivery.id,'leaseToken',delivery.lease_token,'attempt',delivery.attempt_count,
   'event',jsonb_build_object('id',event.id,'type',event.type,'category',event.category,'payload',event.payload,'read_at',event.read_at,'created_at',event.created_at),
   'subscription',jsonb_build_object('endpoint',device.endpoint,'keys',jsonb_build_object('p256dh',device.p256dh,'auth',device.auth_key)),
   'accountId',event.recipient_id,'previews',coalesce(options.previews,true)));
 end loop;
 return result;
end; $$;

create function public.notifications_finish_push(target uuid,lease uuid,outcome text,error_code text default null)
 returns boolean language plpgsql security definer set search_path='' as $$
declare delivery public.notification_push_deliveries;
begin
 select * into delivery from public.notification_push_deliveries where id=target and status='sending' and lease_token=lease for update;
 if not found then return false; end if;
 if outcome='gone' then update public.notification_push_devices set revoked_at=now() where id=delivery.device_id; end if;
 update public.notification_push_deliveries set
  status=case when outcome='sent' then 'sent' when outcome in ('gone','skipped') then 'skipped' when delivery.attempt_count>=5 then 'failed' else 'pending' end,
  sent_at=case when outcome='sent' then now() else null end,
  next_attempt_at=now()+case delivery.attempt_count when 1 then interval '1 minute' when 2 then interval '5 minutes' when 3 then interval '15 minutes' else interval '1 hour' end,
  lease_token=null,lease_until=null,last_error=left(error_code,80)
 where id=target;
 return true;
end; $$;

create function public.notifications_retry_push(target uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.notification_push_deliveries set status='pending',next_attempt_at=now(),lease_token=null,lease_until=null,attempt_count=0,last_error=null where id=target and status='failed';
 return found;
end; $$;
create function public.notifications_metrics() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'pendingPush',(select count(*) from public.notification_push_deliveries where status in ('pending','sending')),
  'failedPush',(select count(*) from public.notification_push_deliveries where status='failed'),
  'oldestPushSeconds',(select coalesce(extract(epoch from now()-min(created_at)),0) from public.notification_push_deliveries where status='pending'),
  'reminderLagSeconds',(select coalesce(extract(epoch from now()-min(due_at)),0) from public.notification_reminder_jobs where status='pending' and due_at<now()),
  'activeDevices',(select count(*) from public.notification_push_devices where revoked_at is null));
$$;
revoke all on function public.notifications_process_reminders(integer),public.notifications_claim_push(integer),
 public.notifications_finish_push(uuid,uuid,text,text),public.notifications_retry_push(uuid),public.notifications_metrics() from public,anon,authenticated;
grant execute on function public.notifications_process_reminders(integer),public.notifications_claim_push(integer),
 public.notifications_finish_push(uuid,uuid,text,text),public.notifications_retry_push(uuid),public.notifications_metrics() to service_role;

create function private.notification_match_search(listing jsonb,filters jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare display_price numeric; minimum numeric; maximum numeric; beds numeric; baths numeric; value jsonb;
 property_types jsonb:='[]'; query_text text:='';
begin
 display_price:=case when listing->>'listing_type'='sale' then coalesce((listing->>'sale_price')::numeric,(listing->>'price')::numeric) else (listing->>'price')::numeric end;
 value:=case when jsonb_typeof(filters->'minPrice')='number' then filters->'minPrice' else filters->'price'->'min' end;
 if jsonb_typeof(value)='number' then minimum:=value::text::numeric; end if;
 value:=case when jsonb_typeof(filters->'maxPrice')='number' then filters->'maxPrice' else filters->'price'->'max' end;
 if jsonb_typeof(value)='number' then maximum:=value::text::numeric; end if;
 if jsonb_typeof(filters->'beds')='number' then beds:=(filters->>'beds')::numeric; end if;
 if jsonb_typeof(filters->'baths')='number' then baths:=(filters->>'baths')::numeric; end if;
 if jsonb_typeof(filters->'propertyTypes')='array' then
  select coalesce(jsonb_agg(v.value),'[]') into property_types from jsonb_array_elements(filters->'propertyTypes') v(value) where jsonb_typeof(v.value)='string';
 elsif jsonb_typeof(filters->'type')='string' then property_types:=jsonb_build_array(filters->'type'); end if;
 if jsonb_typeof(filters->'q')='string' then query_text:=lower(btrim(filters->>'q')); end if;
 return (filters->>'mode' is null or filters->>'mode' not in ('rent','buy') or listing->>'listing_type'=case filters->>'mode' when 'buy' then 'sale' else 'rent' end)
  and (minimum is null or display_price>=minimum) and (maximum is null or display_price<=maximum)
  and (beds is null or (listing->>'bedrooms')::numeric>=beds) and (baths is null or (listing->>'bathrooms')::numeric>=baths)
  and (jsonb_array_length(property_types)=0 or property_types ? (listing->>'property_type'))
  and (query_text='' or position(query_text in lower(coalesce(listing->>'title','')||' '||coalesce(listing->>'address','')))>0);
end; $$;

create function private.notification_saved_reminders(target uuid,entry boolean) returns void
 language plpgsql security definer set search_path='' as $$
declare item jsonb; cat text; saver record; deadline timestamptz; reminder_kind text; version text;
begin
 if entry then select content,category into item,cat from public.approved_entry_specials where id=target;
 else item:=private.notification_offer_content(target); cat:='shopping'; end if;
 update public.notification_reminder_jobs set status='cancelled'
  where source_id=target and source_kind=case when entry then 'entry' else 'offer' end and status='pending'
   and (not exists(select 1 from public.saved_specials s where s.user_id=recipient_id and (s.entry_id=target or s.offer_id=target))
     or source_version is distinct from item->>case when kind='event_start' then 'startsAt' else 'endsAt' end);
 if item is null then return; end if;
 for saver in select user_id from public.saved_specials where entry_id=target or offer_id=target loop
  if cat='event' then deadline:=(item->>'startsAt')::timestamptz; version:=item->>'startsAt'; reminder_kind:='event_start';
  else deadline:=(item->>'endsAt')::timestamptz; version:=item->>'endsAt'; reminder_kind:='special_end'; end if;
  if deadline is not null then
   perform private.notification_schedule(saver.user_id,case when entry then 'entry' else 'offer' end,target,version,reminder_kind,
    deadline-interval '1 day',deadline-interval '1 day'+interval '5 minutes','offers',
    jsonb_build_object('message',case when cat='event' then 'An event you saved starts tomorrow.' else 'A Special you saved ends tomorrow.' end,
      'entryId',case when entry then target else null end,'offerId',case when not entry then target else null end,'entryCategory',cat));
  end if;
 end loop;
end; $$;

create function private.notification_source_event() returns trigger language plpgsql security definer set search_path='' as $$
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
 when 'shopping_offer_events','pinpoint_entry_events','service_submission_events','shopping_offer_decisions','pinpoint_entry_corrections','pinpoint_entry_publication_reviews','pinpoint_entry_removals','shopping_offer_permission_reviews','shopping_offer_location_reviews' then
  label:=coalesce(n->>'action',case tg_table_name
    when 'pinpoint_entry_corrections' then 'corrections requested' when 'pinpoint_entry_publication_reviews' then 'approved'
    when 'pinpoint_entry_removals' then 'removed' when 'shopping_offer_permission_reviews' then 'permission verified' when 'shopping_offer_location_reviews' then 'location verified' end);
  if label is null or label in ('enroll','create','save') then return new; end if;
  target:=coalesce((n->>'offer_id')::uuid,(n->>'entry_id')::uuid,(n->>'service_id')::uuid);
  recipient:=(n->>'poster_id')::uuid;
  if recipient is null and tg_table_name='service_submission_events' then select poster_id into recipient from public.service_submissions where id=target; end if;
  if recipient is null and tg_table_name='pinpoint_entry_removals' then select poster_id into recipient from public.pinpoint_entries where id=target; end if;
  if tg_table_name='pinpoint_entry_removals' then perform private.notification_saved_reminders(target,true); end if;
  cat:='offers'; body:=jsonb_build_object('message','Your listing: '||label||'.','title','Listing update',
   'entryId',n->>'entry_id','entryCategory',n->>'category','offerId',n->>'offer_id','serviceId',n->>'service_id','reason',left(n->>'reason',400));
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
end; $$;

do $$ declare source text; begin
 foreach source in array array['messages','applications','call_sessions','profile_contact_requests','showing_requests','viewing_slot_offers','viewings','live_tours',
  'shopping_offer_events','pinpoint_entry_events','service_submission_events','shopping_offer_decisions','pinpoint_entry_corrections','pinpoint_entry_publication_reviews',
  'pinpoint_entry_removals','shopping_offer_permission_reviews','shopping_offer_location_reviews','listings','profile_reviews','moderation_cases','account_security_events',
  'verification_checks','organization_invitations','organization_memberships','approved_entry_specials','shopping_offers','saved_specials','buyer_interests','user_favorites','viewing_slots','offer_posters','entry_posters'] loop
  execute format('create trigger notification_source_event after insert or update or delete on public.%I for each row execute function private.notification_source_event()',source);
 end loop;
end $$;

-- Suppress replaced post-commit producers only while transactional producers are enabled.
-- Operations alerts and document-expiry producers remain on their existing path.
create function private.notification_legacy_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.notification_flag('notifications_event_generation') and new.source_kind is null and
   new.type::text in ('new_message','new_application','application_status_changed','viewing_proposed','viewing_booked','incoming_call',
    'showing_request','showing_accepted','showing_declined','live_tour_started','live_tour_scheduled','live_tour_reminder') then return null; end if;
 return new;
end; $$;
create trigger notification_legacy_guard before insert on public.notification_events for each row execute function private.notification_legacy_guard();

-- Private trigger helpers cannot be invoked by browser roles even when private has USAGE.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname like 'notification_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;

create function public.notification_client_flags() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.notification_access() then raise exception 'Account access required' using errcode='42501'; end if;
 return jsonb_build_object('inbox',private.notification_flag('notifications_inbox'),'push',private.notification_flag('notifications_push'),
   'reminders',private.notification_flag('notifications_reminders'));
end; $$;
revoke all on function public.notification_client_flags() from public,anon;
grant execute on function public.notification_client_flags() to authenticated;
create function private.notification_validate_options() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 return new;
end; $$;
create trigger notification_options_validate before insert or update on public.notification_options for each row execute function private.notification_validate_options();

-- Browser-facing records expose inbox content, not infrastructure metadata.
create function public.notifications_claim_email(batch_size integer default 20) returns setof uuid
 language plpgsql security definer set search_path='' as $$
declare item public.notification_events;
begin
 if not private.notification_flag('notifications_event_generation') then return; end if;
 for item in select e.* from public.notification_events e
  where e.sent_at is null and e.digest_at is null and e.attempt_count<5
   and (e.locked_at is null or e.locked_at<now()-interval '5 minutes') and e.next_attempt_at<=now()
   and ((e.source_kind is not null and e.source_kind<>'document') or e.created_at >= (select updated_at from public.app_feature_flags where key='notifications_event_generation'))
   and coalesce((select enabled and frequency='instant' from public.notification_subscriptions s
    where s.user_id=e.recipient_id and s.category=e.category and s.channel='email'),true)
  order by created_at limit greatest(1,least(batch_size,20)) for update skip locked loop
  -- Reserve publication for this sweep without claiming the existing email processor's lock.
  update public.notification_events set next_attempt_at=now()+interval '5 minutes' where id=item.id;
  return next item.id;
 end loop;
end; $$;
revoke all on function public.notifications_claim_email(integer) from public,anon,authenticated;
grant execute on function public.notifications_claim_email(integer) to service_role;
revoke all on function private.notification_validate_options() from public,anon,authenticated;

-- Use the same public visibility decisions as the existing Specials projection.
create function private.notification_offer_content(target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb; content jsonb;
begin
 snapshot:=private.pinpoint_offer_public_snapshot(target,now());
 if snapshot is null or snapshot->>'status' not in ('scheduled','live') then return null; end if;
 select r.content into content from public.shopping_offer_revisions r where r.id=(snapshot->>'revisionId')::uuid;
 return content;
end; $$;
revoke all on function private.notification_offer_content(uuid) from public,anon,authenticated;

-- Revalidate immediately before network delivery, including consent or source changes after a claim.
create function public.notifications_authorize_push(target uuid,lease uuid) returns jsonb language sql stable security definer set search_path='' as $authz$
 select coalesce((select jsonb_build_object('allowed',q.lease_token=lease and q.status='sending' and q.lease_until>now()
   and private.notification_flag('notifications_push') and private.notification_delivery_allowed(e,d),'previews',coalesce(o.previews,true))
 from public.notification_push_deliveries q join public.notification_events e on e.id=q.event_id
 join public.notification_push_devices d on d.id=q.device_id left join public.notification_options o on o.user_id=e.recipient_id
 where q.id=target),jsonb_build_object('allowed',false,'previews',false));
$authz$;
revoke all on function public.notifications_authorize_push(uuid,uuid) from public,anon,authenticated;
grant execute on function public.notifications_authorize_push(uuid,uuid) to service_role;

-- Enforce the same active session check for direct Data API access and Realtime.
create policy "Notification active session" on public.notification_events as restrictive for all to authenticated
 using(public.notification_access()) with check(public.notification_access());
alter policy "Own notification options" on public.notification_options to authenticated
 using(user_id=(select auth.uid()) and public.notification_access())
 with check(user_id=(select auth.uid()) and public.notification_access());
create policy "Subscription active session" on public.notification_subscriptions as restrictive for all to authenticated
 using(public.notification_access()) with check(public.notification_access());

create or replace function public.enqueue_profile_document_expiry_reminders() returns integer
 language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
 insert into public.notification_events(recipient_id,type,category,payload,idempotency_key,source_kind,source_id)
 select d.owner_id,'profile_document_expiry','verification',
   jsonb_build_object('message',d.display_name||' expires in '||(d.expires_at-current_date)::text||' day'||case when d.expires_at-current_date=1 then '' else 's' end||'.','documentId',d.id,'expiresAt',d.expires_at),
   'profile-document-expiry:'||d.id||':'||d.expires_at||':'||(d.expires_at-current_date),'document',d.id
 from public.profile_documents d where d.deleted_at is null and d.expires_at-current_date in (30,7,1,0)
 on conflict(idempotency_key) do nothing;
 get diagnostics inserted_count=row_count;return inserted_count;
end; $$;
-- Retain the existing daily cron schedule; renewed expiry dates get their own keys.
revoke all on function public.enqueue_profile_document_expiry_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_profile_document_expiry_reminders() to service_role;

create index notification_events_actor_idx on public.notification_events(actor_id) where actor_id is not null;
create index notification_devices_session_idx on public.notification_push_devices(session_id);
create index notification_push_device_idx on public.notification_push_deliveries(device_id);
create index notification_reminders_source_idx on public.notification_reminder_jobs(source_kind,source_id) where status='pending';

alter table public.messages add column system_call_id uuid references public.call_sessions(id) on delete set null;
create unique index messages_system_call_once_idx on public.messages(system_call_id) where system_call_id is not null;
create function private.notification_system_message() returns trigger language plpgsql security definer set search_path='' as $$
declare call public.call_sessions;
begin
 if tg_op='UPDATE' and old.system_call_id is not null and new.system_call_id is distinct from old.system_call_id then
  if not exists(select 1 from public.call_sessions where id=old.system_call_id) then return new; end if;
  raise exception 'System call marker is immutable' using errcode='22023';
 end if;
 if new.system_call_id is null then return new; end if;
 select * into call from public.call_sessions where id=new.system_call_id;
 if not found or call.status::text not in ('ended','missed','declined') or new.conversation_id<>call.conversation_id or new.listing_id<>call.listing_id or new.sender_id<>call.caller_id
   or new.content<>(case when call.answered_at is not null then 'Video call ended.' when call.status::text='missed' then 'Missed video call.' when call.status::text='declined' then 'Video call declined.' else 'Video call cancelled.' end) then
  raise exception 'Invalid system call transcript' using errcode='22023';
 end if;
 return new;
end; $$;
create trigger notification_system_message before insert or update on public.messages for each row execute function private.notification_system_message();
revoke all on function private.notification_system_message() from public,anon,authenticated;

create function private.notification_actor_label(actor uuid) returns text language sql stable security definer set search_path='' as $$
 select nullif(left(display_name,80),'') from public.public_profiles
 where profile_id=actor and profile_audience::text in ('everyone','members','interactions');
$$;
revoke all on function private.notification_actor_label(uuid) from public,anon,authenticated;

create index notification_unread_count_idx on public.notification_events(recipient_id) where archived_at is null and in_app_visible and read_at is null;

-- Match the existing app-owned saved-search filter semantics, including legacy shapes.


create function private.notification_event_valid(event public.notification_events) returns boolean language plpgsql stable security definer set search_path='' as $$
declare job public.notification_reminder_jobs;
begin
 if not private.notification_eligible(event.recipient_id,event.actor_id) then return false; end if;
 if event.type::text='profile_document_expiry' then
  return exists(select 1 from public.profile_documents d where d.id=(event.payload->>'documentId')::uuid and d.owner_id=event.recipient_id and d.deleted_at is null and d.expires_at::text=event.payload->>'expiresAt');
 elsif event.source_kind='tour' then
  return exists(select 1 from public.live_tours t where t.id=event.source_id and (t.status::text in ('live','scheduled') or (t.status::text='cancelled' and event.type::text='interaction_update')) and
   (t.host_id=event.recipient_id or exists(select 1 from public.user_favorites f where f.listing_id=t.listing_id and f.user_id=event.recipient_id)
    or exists(select 1 from public.search_alerts a join public.listings l on l.id=t.listing_id where a.user_id=event.recipient_id and l.longitude between a.bounding_box_west and a.bounding_box_east and l.latitude between a.bounding_box_south and a.bounding_box_north and private.notification_match_search(to_jsonb(l),coalesce(a.filters,'{}')))));
 elsif event.source_kind='reminder' then
  select * into job from public.notification_reminder_jobs where id=event.source_id;
  return found and job.expires_at>now() and private.notification_reminder_valid(job);
 elsif event.type::text='incoming_call' and event.payload->>'kind'='incoming' then
  return exists(select 1 from public.call_sessions c where c.id=event.source_id and c.status::text='ringing');
 elsif event.source_kind='message' then
  return exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
   where m.id=event.source_id and m.read_at is null and event.recipient_id in (c.renter_id,c.landlord_id));
 elsif event.source_kind='contact' then
  return exists(select 1 from public.profile_contact_requests where id=event.source_id and recipient_id=event.recipient_id and handled_at is null);
 elsif event.source_kind='saved_listing' then
  return exists(select 1 from public.user_favorites where listing_id=event.source_id and user_id=event.recipient_id);
 elsif event.source_kind='saved_entry' then
  return exists(select 1 from public.saved_specials where entry_id=event.source_id and user_id=event.recipient_id);
 elsif event.source_kind='saved_offer' then
  return exists(select 1 from public.saved_specials where offer_id=event.source_id and user_id=event.recipient_id);
 end if;
 return true;
end; $$;
create function public.notifications_email_allowed(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select private.notification_event_valid(e) from public.notification_events e where id=target),false); $$;
revoke all on function private.notification_event_valid(public.notification_events),public.notifications_email_allowed(uuid) from public,anon,authenticated;
grant execute on function public.notifications_email_allowed(uuid) to service_role;
create function public.notification_contact_states(request_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $states$
begin
 if not public.notification_access() then raise exception 'Account access required' using errcode='42501'; end if;
 if cardinality(request_ids)>50 then raise exception 'Too many requests' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'handled',handled_at is not null)),'[]') from public.profile_contact_requests
   where recipient_id=auth.uid() and id=any(request_ids));
end; $states$;
revoke all on function public.notification_contact_states(uuid[]) from public,anon;
grant execute on function public.notification_contact_states(uuid[]) to authenticated;
