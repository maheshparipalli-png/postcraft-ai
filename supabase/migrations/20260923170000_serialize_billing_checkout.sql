-- Serialize Razorpay checkout creation per user so concurrent requests cannot
-- create multiple external subscriptions for the same billing account.

alter table public.billing_subscriptions
  add column if not exists checkout_lock_until timestamptz;

create or replace function public.claim_billing_checkout_lock(
  p_user_id uuid,
  p_lock_until timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billing_subscriptions
  set checkout_lock_until = p_lock_until,
      updated_at = now()
  where user_id = p_user_id
    and (
      checkout_lock_until is null
      or checkout_lock_until < now()
    );

  return found;
end;
$$;

create or replace function public.release_billing_checkout_lock(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billing_subscriptions
  set checkout_lock_until = null,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.claim_billing_checkout_lock(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.release_billing_checkout_lock(uuid) from public, anon, authenticated;
grant execute on function public.claim_billing_checkout_lock(uuid, timestamptz) to service_role;
grant execute on function public.release_billing_checkout_lock(uuid) to service_role;
