alter table public.profiles
  add column if not exists email_verified_at timestamptz;

update public.profiles
set email_verified_at = auth.users.email_confirmed_at,
    updated_at = now()
from auth.users
where public.profiles.id = auth.users.id
  and public.profiles.email_verified_at is null
  and auth.users.email_confirmed_at is not null;

create table if not exists public.auth_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_email_verification_tokens_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint auth_email_verification_tokens_email_check check (position('@' in email) > 1),
  constraint auth_email_verification_tokens_expiry_check check (expires_at > created_at)
);

alter table public.auth_email_verification_tokens enable row level security;
alter table public.auth_email_verification_tokens force row level security;

revoke all on table public.auth_email_verification_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_email_verification_tokens to service_role;

create policy "Service role can read auth email verification tokens"
  on public.auth_email_verification_tokens for select
  to service_role
  using (true);

create policy "Service role can insert auth email verification tokens"
  on public.auth_email_verification_tokens for insert
  to service_role
  with check (true);

create policy "Service role can update auth email verification tokens"
  on public.auth_email_verification_tokens for update
  to service_role
  using (true)
  with check (true);

create policy "Service role can delete auth email verification tokens"
  on public.auth_email_verification_tokens for delete
  to service_role
  using (true);

create index if not exists auth_email_verification_tokens_user_id_idx
  on public.auth_email_verification_tokens(user_id);

create index if not exists auth_email_verification_tokens_expires_at_idx
  on public.auth_email_verification_tokens(expires_at);
