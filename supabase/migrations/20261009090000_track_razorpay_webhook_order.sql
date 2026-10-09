alter table public.billing_subscriptions
  add column if not exists razorpay_event_created_at timestamptz;
