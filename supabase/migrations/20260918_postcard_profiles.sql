-- Account-level PostCard profile
-- Run this migration in Supabase SQL Editor before using the account profile API.

create table if not exists public.postcard_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  handle text not null default '',
  photo_data_url text,
  updated_at timestamptz not null default now()
);

alter table public.postcard_profiles enable row level security;

drop policy if exists "Users can view their own PostCard profile" on public.postcard_profiles;
create policy "Users can view their own PostCard profile"
on public.postcard_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own PostCard profile" on public.postcard_profiles;
create policy "Users can create their own PostCard profile"
on public.postcard_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own PostCard profile" on public.postcard_profiles;
create policy "Users can update their own PostCard profile"
on public.postcard_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.postcard_profiles to authenticated;
