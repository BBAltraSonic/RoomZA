create table if not exists public.auth_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_password_reset_tokens_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint auth_password_reset_tokens_expiry_check check (expires_at > created_at)
);

alter table public.auth_password_reset_tokens enable row level security;
alter table public.auth_password_reset_tokens force row level security;

revoke all on table public.auth_password_reset_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_password_reset_tokens to service_role;

create policy "Service role can read auth password reset tokens"
  on public.auth_password_reset_tokens for select
  to service_role
  using (true);

create policy "Service role can insert auth password reset tokens"
  on public.auth_password_reset_tokens for insert
  to service_role
  with check (true);

create policy "Service role can update auth password reset tokens"
  on public.auth_password_reset_tokens for update
  to service_role
  using (true)
  with check (true);

create policy "Service role can delete auth password reset tokens"
  on public.auth_password_reset_tokens for delete
  to service_role
  using (true);

create index if not exists auth_password_reset_tokens_user_id_idx
  on public.auth_password_reset_tokens(user_id);

create index if not exists auth_password_reset_tokens_expires_at_idx
  on public.auth_password_reset_tokens(expires_at);
