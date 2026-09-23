-- Allow a billing row to exist before a user starts a trial or completes paid checkout.
-- The application uses this state only as a pre-checkout marker.

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_status_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_status_check
  check (status in ('not_started','trialing','grace','active','expired','cancelled','past_due','suspended'));
