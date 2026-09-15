-- Run this once in Supabase SQL Editor after billing_subscriptions.sql.
-- It allows an authenticated user to create only their own billing row.

drop policy if exists "users can create own billing subscription"
on public.billing_subscriptions;

create policy "users can create own billing subscription"
on public.billing_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);
