-- PostCraft personalized content interests.
create table if not exists public.postcraft_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interests text[] not null default '{}',
  interests_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists postcraft_user_preferences_interests_idx
  on public.postcraft_user_preferences using gin(interests);

alter table public.postcraft_user_preferences enable row level security;

drop policy if exists "users manage own content preferences"
  on public.postcraft_user_preferences;

create policy "users manage own content preferences"
on public.postcraft_user_preferences
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
on public.postcraft_user_preferences
to authenticated;
