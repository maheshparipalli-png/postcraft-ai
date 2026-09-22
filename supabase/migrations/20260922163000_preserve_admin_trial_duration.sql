-- Preserve administrator-selected trial durations.
-- Normal self-service trials are fixed at 15 days + 3-day grace.
-- Admin-created/reset trials may intentionally use a custom duration.

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
