-- Harden PostCraft trial rules.
-- The application already uses a 15-day trial + 3-day grace period.
-- This migration makes the database authoritative so older/deployed code cannot
-- accidentally create a shorter trial.

alter table public.billing_subscriptions
  add column if not exists grace_ends_at timestamptz,
  add column if not exists trial_reset_count integer not null default 0,
  add column if not exists last_trial_reset_at timestamptz,
  add column if not exists last_trial_reset_reason text;

drop policy if exists "users can create own billing subscription"
on public.billing_subscriptions;

create policy "users can create own billing subscription"
on public.billing_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

create or replace function public.normalize_postcraft_trial_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'trialing'
     and new.trial_started_at is not null
     and coalesce(new.trial_reset_count, 0) = 0 then
    new.trial_ends_at := new.trial_started_at + interval '15 days';
    new.grace_ends_at := new.trial_ends_at + interval '3 days';
  end if;

  return new;
end;
$$;

drop trigger if exists billing_subscriptions_trial_dates
on public.billing_subscriptions;

create trigger billing_subscriptions_trial_dates
before insert on public.billing_subscriptions
for each row
execute function public.normalize_postcraft_trial_dates();

-- Correct legacy trial rows that were created with a shorter duration.
-- Only rows still in trialing status are adjusted; paid/cancelled/expired
-- subscriptions are never changed.
update public.billing_subscriptions
set
  trial_ends_at = trial_started_at + interval '15 days',
  grace_ends_at = trial_started_at + interval '18 days',
  updated_at = now()
where status = 'trialing'
  and trial_started_at is not null
  and (
    trial_ends_at is null
    or trial_ends_at < trial_started_at + interval '15 days'
  );
