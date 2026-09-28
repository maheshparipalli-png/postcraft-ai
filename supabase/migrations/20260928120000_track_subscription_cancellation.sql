-- Track a requested cancellation without revoking paid access before the
-- current billing cycle ends.
alter table public.billing_subscriptions
  add column if not exists cancel_at_cycle_end boolean not null default false,
  add column if not exists cancellation_requested_at timestamptz;
