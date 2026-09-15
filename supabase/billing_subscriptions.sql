-- PostCraft billing and one-time 24-hour free trial

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
