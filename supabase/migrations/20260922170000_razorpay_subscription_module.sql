-- PostCraft payment module: Razorpay subscription lifecycle and webhook idempotency.

alter table public.billing_subscriptions
  add column if not exists razorpay_customer_id text,
  add column if not exists razorpay_signature_verified_at timestamptz,
  add column if not exists payment_verified_at timestamptz;

create unique index if not exists billing_subscriptions_razorpay_subscription_id_idx
  on public.billing_subscriptions(razorpay_subscription_id)
  where razorpay_subscription_id is not null;

create unique index if not exists billing_subscriptions_razorpay_payment_id_idx
  on public.billing_subscriptions(razorpay_payment_id)
  where razorpay_payment_id is not null;

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_status_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_status_check
  check (status in (
    'trialing',
    'grace',
    'active',
    'expired',
    'cancelled',
    'past_due',
    'suspended'
  ));

create table if not exists public.razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.razorpay_webhook_events enable row level security;
revoke all on public.razorpay_webhook_events from anon, authenticated;
