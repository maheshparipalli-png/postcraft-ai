-- PostCraft SaaS foundation: 15-day trial, 3-day grace period, roles and admin audit logs.

-- Keep this migration self-contained. The legacy billing_subscriptions.sql file
-- was previously a standalone SQL script, not a migration, so a fresh database
-- may not have the table yet.
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null default 'pro_monthly',
  status text not null default 'trialing',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  razorpay_order_id text,
  razorpay_subscription_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_subscriptions_status_check
    check (status in ('trialing', 'active', 'expired', 'cancelled', 'past_due'))
);

create unique index if not exists billing_subscriptions_user_id_unique
on public.billing_subscriptions(user_id);

alter table public.billing_subscriptions enable row level security;

drop policy if exists "users can view own billing subscription"
on public.billing_subscriptions;

create policy "users can view own billing subscription"
on public.billing_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_billing_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists billing_subscriptions_updated_at
on public.billing_subscriptions;

create trigger billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row
execute function public.set_billing_subscriptions_updated_at();

alter table public.billing_subscriptions
  add column if not exists grace_ends_at timestamptz,
  add column if not exists trial_reset_count integer not null default 0,
  add column if not exists last_trial_reset_at timestamptz,
  add column if not exists last_trial_reset_reason text;

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_status_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_status_check
  check (status in ('trialing', 'grace', 'active', 'expired', 'cancelled', 'past_due', 'suspended'));

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('user', 'admin', 'super_admin'))
);

create index if not exists profiles_role_idx on public.profiles(role);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;

create or replace function public.handle_new_postcraft_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_postcraft on auth.users;
create trigger on_auth_user_created_postcraft
after insert on auth.users
for each row execute function public.handle_new_postcraft_user();

insert into public.profiles (user_id, display_name)
select
  id,
  coalesce(
    nullif(raw_user_meta_data ->> 'full_name', ''),
    nullif(raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(email, ''), '@', 1)
  )
from auth.users
on conflict (user_id) do nothing;

create or replace function public.set_postcraft_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_postcraft_profile_updated_at();

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);

create index if not exists admin_audit_logs_target_user_idx
  on public.admin_audit_logs(target_user_id);

alter table public.admin_audit_logs enable row level security;

-- No client-facing policies: admin operations use the server-side service-role client.
revoke all on public.admin_audit_logs from anon, authenticated;

-- Future trials use these durations. Existing subscriptions are left intact.
