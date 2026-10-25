-- Disposable test foundation, based on the deployed column/enum contracts. No production data.
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema private;
create table auth.users(id uuid primary key,is_anonymous boolean default false,banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('test.session',true))$$;
create type public.admin_level as enum('owner','admin');
create type public.application_status as enum('submitted','under_review','shortlisted','rejected','approved','withdrawn');
create type public.blog_media_kind as enum('cover','inline');
create type public.blog_post_status as enum('draft','published');
create type public.buyer_interest_status as enum('interested','negotiating','accepted','declined');
create type public.call_status as enum('ringing','active','ended','declined','missed');
create type public.conversation_type as enum('inquiry','application');
create type public.document_type as enum('id','payslip');
create type public.listing_import_asset_state as enum('uploaded','url_pending','matched','unmatched','rejected','attached');
create type public.listing_import_duplicate_strategy as enum('skip','replace','merge','import_new');
create type public.listing_import_issue_severity as enum('blocking','publish_blocker','warning');
create type public.listing_import_job_stage as enum('source','upload','mapping','validating','resolving','preview','committing','confirming','complete','cancelled','failed');
create type public.listing_import_row_state as enum('pending','parse_blocked','draft_ready','publish_blocked','warning','duplicate_review','committed','published','skipped','failed','removed');
create type public.listing_import_source_kind as enum('csv','xlsx','xml','json','pasted_table','image_archive','image_folder','image_urls','pinpoint_v1');
create type public.listing_status as enum('draft','published','archived');
create type public.listing_type as enum('rent','sale');
create type public.live_tour_recording_status as enum('off','awaiting_consent','recording','stopped','failed');
create type public.live_tour_status as enum('scheduled','live','ended','cancelled');
create type public.marketplace_persona as enum('renter','buyer','landlord','seller');
create type public.moderation_case_status as enum('open','in_review','resolved','dismissed');
create type public.moderation_category as enum('fraud_or_scam','misleading_listing','duplicate_or_spam','discrimination','harassment','safety','privacy','other');
create type public.moderation_priority as enum('low','normal','high','urgent');
create type public.notification_category as enum('messages','applications','viewings','offers','saved_searches','marketing','security','account_updates','reviews','verification','blog_updates');
create type public.notification_channel as enum('in_app','email');
create type public.notification_frequency as enum('instant','hourly','daily','weekly','never');
create type public.notification_type as enum('new_application','new_message','viewing_proposed','viewing_booked','application_status_changed','incoming_call','admin_alert','moderation_update','showing_request','showing_accepted','showing_declined','live_tour_started','live_tour_scheduled','live_tour_reminder','profile_document_expiry');
create type public.organization_role as enum('owner','admin','agent');
create type public.profile_activity_visibility as enum('private','public');
create type public.profile_audience as enum('everyone','members','interactions','no_one');
create type public.profile_review_status as enum('draft','submitted','published','hidden','removed');
create type public.purchase_stage as enum('property_saved','viewing_scheduled','viewing_completed','contacted_seller','negotiating','sale_agreed','purchase_complete');
create type public.showing_status as enum('requested','accepted','checked_in','declined','completed','cancelled','expired');
create type public.showing_window as enum('now','within_15','within_30','today');
create type public.viewing_mode as enum('in_person','video_call');
create type public.viewing_status as enum('booked','cancelled','completed');
create table public.account_security_events(id uuid primary key default gen_random_uuid(),user_id uuid,event_key text,device_label text,user_agent text,ip_hash text,is_suspicious boolean,metadata jsonb,occurred_at timestamptz);
create table public.account_suspensions(id uuid primary key default gen_random_uuid(),user_id uuid,suspended_by uuid,reason text,suspended_at timestamptz,suspended_until timestamptz,restored_at timestamptz,restored_by uuid);
create table public.app_feature_flags(key text primary key,enabled boolean,description text,updated_at timestamptz);
create table public.applications(id uuid primary key default gen_random_uuid(),listing_id uuid,renter_id uuid,status public.application_status,full_name text,income numeric,employment_status text,move_in_date date,household_size integer,created_at timestamptz,updated_at timestamptz);
create table public.approved_entry_specials(id uuid primary key default gen_random_uuid(),revision_id uuid,category text,area_id uuid,content jsonb,approved_at timestamptz);
create table public.buyer_interests(id uuid primary key default gen_random_uuid(),buyer_id uuid,seller_id uuid,listing_id uuid,status public.buyer_interest_status,notes text,viewing_date timestamptz,created_at timestamptz,updated_at timestamptz);
create table public.call_sessions(id uuid primary key default gen_random_uuid(),conversation_id uuid,listing_id uuid,caller_id uuid,callee_id uuid,status public.call_status,provider text,room_id text,join_url text,started_at timestamptz,answered_at timestamptz,ended_at timestamptz,created_at timestamptz,media_mode text);
create table public.conversations(id uuid primary key default gen_random_uuid(),listing_id uuid,renter_id uuid,landlord_id uuid,application_id uuid,type public.conversation_type,created_at timestamptz);
create table public.listings(id uuid primary key default gen_random_uuid(),landlord_id uuid,title text,price integer,address text,latitude numeric,longitude numeric,location text,bedrooms numeric,bathrooms numeric,parking_type text,parking_count integer,electricity_type text,water_availability text,lease_duration text,availability_date date,metadata jsonb,status public.listing_status,created_at timestamptz,updated_at timestamptz,description text,property_type text,electricity_included boolean,electricity_estimate integer,water_included boolean,water_estimate integer,wifi_available boolean,wifi_included boolean,wifi_estimate integer,parking_included boolean,parking_estimate integer,security_fee_estimate integer,listing_type public.listing_type,sale_price integer,organization_id uuid,is_featured boolean,address_fingerprint text,guest_contact_exempt boolean);
create table public.live_tours(id uuid primary key default gen_random_uuid(),listing_id uuid,host_id uuid,status public.live_tour_status,provider text,room_id text,join_url text,started_at timestamptz,ended_at timestamptz,peak_viewers integer,scheduled_at timestamptz,scheduled_duration_minutes integer,reminder_sent_at timestamptz,recording_status public.live_tour_recording_status,recording_started_at timestamptz,recording_ended_at timestamptz,recording_retention_expires_at timestamptz,recording_external_id text,recording_url text,recording_error text);
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_id uuid,listing_id uuid,content text,created_at timestamptz,read_at timestamptz);
create table public.moderation_cases(id uuid primary key default gen_random_uuid(),reporter_id uuid,listing_id uuid,reported_user_id uuid,category public.moderation_category,details text,status public.moderation_case_status,priority public.moderation_priority,assigned_to uuid,resolution_note text,created_at timestamptz,updated_at timestamptz,resolved_at timestamptz,message_id uuid,listing_image_id uuid,target_context jsonb,first_reviewed_at timestamptz,shopping_offer_id uuid);
create table public.notification_events(id uuid primary key default gen_random_uuid(),recipient_id uuid,type public.notification_type,payload jsonb default '{}'::jsonb,sent_at timestamptz,digest_at timestamptz,created_at timestamptz default now(),attempt_count integer default 0,next_attempt_at timestamptz default now(),locked_at timestamptz,last_error text,idempotency_key text,read_at timestamptz);
create unique index notification_events_idempotency_key_idx on public.notification_events(idempotency_key) where idempotency_key is not null;
create table public.notification_preferences(user_id uuid,application_updates boolean,viewing_updates boolean,message_digest boolean,search_alerts boolean,marketing boolean,location_personalization boolean,digest_frequency text,created_at timestamptz,updated_at timestamptz);
create table public.notification_subscriptions(user_id uuid,category public.notification_category,channel public.notification_channel,enabled boolean,frequency public.notification_frequency,created_at timestamptz,updated_at timestamptz,primary key(user_id,category,channel));
create table public.organization_invitations(id uuid primary key default gen_random_uuid(),organization_id uuid,email text,role public.organization_role,office_id uuid,token_hash text,invited_by uuid,expires_at timestamptz,accepted_at timestamptz,accepted_by uuid,revoked_at timestamptz,created_at timestamptz);
create table public.organization_memberships(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,role public.organization_role,office_id uuid,invited_by uuid,joined_at timestamptz,revoked_at timestamptz,created_at timestamptz,updated_at timestamptz);
create table public.pinpoint_entries(id uuid primary key default gen_random_uuid(),poster_id uuid,category text,draft jsonb,version integer,pending_revision_id uuid,withdrawn_at timestamptz,created_at timestamptz,updated_at timestamptz,approved_revision_id uuid,guest_contact_exempt boolean);
create table public.pinpoint_entry_corrections(id uuid primary key default gen_random_uuid(),entry_id uuid,revision_id uuid,poster_id uuid,category text,reviewer_id uuid,version integer,reason text,reviewed_at timestamptz);
create table public.pinpoint_entry_events(id uuid primary key default gen_random_uuid(),poster_id uuid,category text,entry_id uuid,revision_id uuid,actor_id uuid,action text,version integer,created_at timestamptz);
create table public.pinpoint_entry_publication_reviews(id uuid primary key default gen_random_uuid(),authority_review_id uuid,entry_id uuid,revision_id uuid,poster_id uuid,category text,permission_id uuid,reviewer_id uuid,captured_version integer,area_id uuid,place_snapshot jsonb,authority_notes text,location_notes text,media_state text,reviewed_at timestamptz);
create table public.pinpoint_entry_removals(id uuid primary key default gen_random_uuid(),entry_id uuid,revision_id uuid,reviewer_id uuid,reason text,occurred_at timestamptz);
create table public.profile_blocks(blocker_id uuid,blocked_id uuid,created_at timestamptz);
create table public.profile_contact_requests(id uuid primary key default gen_random_uuid(),requester_id uuid,recipient_id uuid,intent text,listing_id uuid,message text,created_at timestamptz);
create table public.profile_mutes(muter_id uuid,muted_id uuid,created_at timestamptz);
create table public.profile_reviews(id uuid primary key default gen_random_uuid(),entitlement_id uuid,reviewer_id uuid,subject_id uuid,communication smallint,honesty smallint,professionalism smallint,property_accuracy smallint,viewing_experience smallint,responsiveness smallint,overall smallint,body text,status public.profile_review_status,submitted_at timestamptz,publish_after timestamptz,published_at timestamptz,moderated_at timestamptz,moderation_reason text,created_at timestamptz,updated_at timestamptz);
create table public.profiles(id uuid primary key default gen_random_uuid(),email text,phone text,phone_verified boolean,role text,created_at timestamptz,updated_at timestamptz,email_verified_at timestamptz,full_name text,avatar_url text,about text,last_seen_at timestamptz,presence_status text,availability_mode text,active_organization_id uuid);
create table public.saved_specials(user_id uuid,offer_id uuid,entry_id uuid,created_at timestamptz);
create table public.search_alerts(id uuid primary key default gen_random_uuid(),user_id uuid,email text,bounding_box_west double precision,bounding_box_south double precision,bounding_box_east double precision,bounding_box_north double precision,filters jsonb,created_at timestamptz);
create table public.service_submission_events(id uuid primary key default gen_random_uuid(),service_id uuid,actor_id uuid,action text,version integer,content jsonb,reason text,occurred_at timestamptz);
create table public.service_submissions(id uuid primary key default gen_random_uuid(),poster_id uuid,draft jsonb,submitted jsonb,status text,version integer,created_at timestamptz,updated_at timestamptz,guest_contact_exempt boolean);
create table public.shopping_offer_decisions(id uuid primary key default gen_random_uuid(),offer_id uuid,revision_id uuid,poster_id uuid,actor_id uuid,action text,captured_version integer,version integer,permission_review_id uuid,location_review_id uuid,intake_event_id uuid,reason text,statement_version text,occurred_at timestamptz);
create table public.shopping_offer_events(id uuid primary key default gen_random_uuid(),poster_id uuid,offer_id uuid,revision_id uuid,actor_id uuid,action text,version integer,reason text,occurred_at timestamptz);
create table public.shopping_offer_location_reviews(id uuid primary key default gen_random_uuid(),offer_id uuid,revision_id uuid,poster_id uuid,reviewer_id uuid,offer_version integer,permission_review_id uuid,place_id uuid,place_snapshot jsonb,provenance_reference text,shop_reference text,verification_note text,statement_version text,checked_at timestamptz);
create table public.shopping_offer_permission_reviews(id uuid primary key default gen_random_uuid(),offer_id uuid,revision_id uuid,poster_id uuid,reviewer_id uuid,offer_version integer,evidence_kind text,source_reference text,verification_note text,statement_version text,checked_at timestamptz);
create table public.shopping_offer_revisions(id uuid primary key default gen_random_uuid(),offer_id uuid,poster_id uuid,content jsonb,submitted_at timestamptz);
create table public.shopping_offers(id uuid primary key default gen_random_uuid(),poster_id uuid,draft jsonb,version integer,pending_revision_id uuid,withdrawn_at timestamptz,created_at timestamptz,updated_at timestamptz,guest_contact_exempt boolean);
create table public.showing_requests(id uuid primary key default gen_random_uuid(),listing_id uuid,conversation_id uuid,renter_id uuid,landlord_id uuid,status public.showing_status,window_choice public.showing_window,eta_minutes integer,requested_at timestamptz,expires_at timestamptz,responded_at timestamptz,checked_in_at timestamptz,completed_at timestamptz,created_at timestamptz);
create table public.user_favorites(id uuid primary key default gen_random_uuid(),user_id uuid,listing_id uuid,created_at timestamptz);
create table public.verification_checks(id uuid primary key default gen_random_uuid(),profile_id uuid,listing_id uuid,check_key text,status text,public_label text,evidence_note text,reviewed_by uuid,verified_at timestamptz,expires_at timestamptz,revoked_at timestamptz,created_at timestamptz,updated_at timestamptz,submitted_at timestamptz,reviewed_at timestamptz,rejected_reason text);
create table public.viewing_slot_offers(id uuid primary key default gen_random_uuid(),slot_id uuid,application_id uuid,created_at timestamptz,buyer_interest_id uuid);
create table public.viewing_slots(id uuid primary key default gen_random_uuid(),listing_id uuid,created_by uuid,start_time timestamptz,end_time timestamptz,is_booked boolean,created_at timestamptz,mode public.viewing_mode);
create table public.viewings(id uuid primary key default gen_random_uuid(),application_id uuid,slot_id uuid,status public.viewing_status,created_at timestamptz,meeting_provider text,meeting_room_id text,meeting_join_url text,meeting_starts_at timestamptz,meeting_ends_at timestamptz,buyer_interest_id uuid);
create function public.is_current_account_active() returns boolean language sql stable as $$select auth.uid() is not null$$;
-- Match the production locking bridge so read-only RLS regressions are visible.
create function public.pinpoint_active_session(actor_id uuid,actor_session_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=actor_session_id and s.user_id=actor_id for share of s,u;
 if not found then return false; end if;
 return exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id join public.profiles p on p.id=u.id
 where u.id=actor_id and s.id=actor_session_id and not coalesce(u.is_anonymous,false)
 and (s.not_after is null or s.not_after>statement_timestamp()) and (u.banned_until is null or u.banned_until<=statement_timestamp()))
 and not exists(select 1 from public.account_suspensions where user_id=actor_id and restored_at is null and (suspended_until is null or suspended_until>statement_timestamp()));
end;
$$;
revoke all on function public.pinpoint_active_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pinpoint_active_session(uuid,uuid) to service_role;
create function private.pinpoint_offer_public_snapshot(target uuid,at_time timestamptz) returns jsonb language sql stable as $$
 select jsonb_build_object('status','live','revisionId',d.revision_id)
 from public.shopping_offer_decisions d join public.shopping_offers o on o.id=d.offer_id
 where d.offer_id=target and d.action='approve' and o.pending_revision_id is null and o.withdrawn_at is null order by d.version desc limit 1;
$$;
alter table public.notification_events enable row level security;
grant usage on schema public,auth to authenticated;
grant select,update,delete on public.notification_events to authenticated;
grant select,insert,update on public.notification_subscriptions to authenticated;
create policy "Own notifications" on public.notification_events to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create policy "Own subscriptions" on public.notification_subscriptions to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create table public.profile_documents(id uuid primary key,owner_id uuid,expires_at date,deleted_at timestamptz,display_name text);

create table public.offer_posters(user_id uuid primary key,revoked_at timestamptz);
create table public.entry_posters(user_id uuid,category text,revoked_at timestamptz,primary key(user_id,category));

create table public.public_profiles(profile_id uuid primary key,display_name text,username text,profile_audience public.profile_audience);

create table private.notification_receipts(n integer); insert into private.notification_receipts values(0);
create function private.record_profile_core_activity() returns trigger language plpgsql security definer as $hook$ begin update private.notification_receipts set n=n+1; return new; end; $hook$;
create trigger notification_events_profile_activity after insert or update on public.notification_events for each row execute function private.record_profile_core_activity();
