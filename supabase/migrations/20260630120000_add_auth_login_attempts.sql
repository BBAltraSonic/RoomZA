create table if not exists public.auth_login_attempts (
  email_hash text primary key,
  attempt_count integer not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_login_attempts_email_hash_check check (email_hash ~ '^[a-f0-9]{64}$'),
  constraint auth_login_attempts_attempt_count_check check (attempt_count >= 0)
);

alter table public.auth_login_attempts enable row level security;
alter table public.auth_login_attempts force row level security;

revoke all on table public.auth_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_login_attempts to service_role;

create policy "Service role can read auth login attempts"
  on public.auth_login_attempts for select
  to service_role
  using (true);

create policy "Service role can insert auth login attempts"
  on public.auth_login_attempts for insert
  to service_role
  with check (true);

create policy "Service role can update auth login attempts"
  on public.auth_login_attempts for update
  to service_role
  using (true)
  with check (true);

create policy "Service role can delete auth login attempts"
  on public.auth_login_attempts for delete
  to service_role
  using (true);

create index if not exists auth_login_attempts_locked_until_idx
  on public.auth_login_attempts(locked_until)
  where locked_until is not null;

create or replace function public.record_auth_login_failure(
  target_email_hash text,
  lockout_threshold integer default 5,
  lockout_seconds integer default 900
)
returns table(email_hash text, attempt_count integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_email_hash is null or target_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid login attempt identifier' using errcode = '22023';
  end if;

  if lockout_threshold < 1 or lockout_seconds < 1 then
    raise exception 'invalid lockout configuration' using errcode = '22023';
  end if;

  return query
  insert into public.auth_login_attempts (
    email_hash,
    attempt_count,
    locked_until,
    last_failed_at,
    updated_at
  )
  values (
    target_email_hash,
    1,
    case
      when lockout_threshold <= 1 then now() + make_interval(secs => lockout_seconds)
      else null
    end,
    now(),
    now()
  )
  on conflict (email_hash) do update
  set attempt_count = case
        when public.auth_login_attempts.locked_until is not null
          and public.auth_login_attempts.locked_until > now()
          then public.auth_login_attempts.attempt_count
        when public.auth_login_attempts.locked_until is not null
          and public.auth_login_attempts.locked_until <= now()
          then 1
        else public.auth_login_attempts.attempt_count + 1
      end,
      locked_until = case
        when public.auth_login_attempts.locked_until is not null
          and public.auth_login_attempts.locked_until > now()
          then public.auth_login_attempts.locked_until
        when public.auth_login_attempts.locked_until is not null
          and public.auth_login_attempts.locked_until <= now()
          then null
        when public.auth_login_attempts.attempt_count + 1 >= lockout_threshold
          then now() + make_interval(secs => lockout_seconds)
        else null
      end,
      last_failed_at = case
        when public.auth_login_attempts.locked_until is not null
          and public.auth_login_attempts.locked_until > now()
          then public.auth_login_attempts.last_failed_at
        else now()
      end,
      updated_at = now()
  returning
    public.auth_login_attempts.email_hash,
    public.auth_login_attempts.attempt_count,
    public.auth_login_attempts.locked_until;
end;
$$;

revoke all on function public.record_auth_login_failure(text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_auth_login_failure(text, integer, integer) to service_role;
