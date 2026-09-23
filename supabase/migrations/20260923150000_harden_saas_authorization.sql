-- Harden SaaS authorization and make the core posts table reproducible.
--
-- Billing mutations are server-only: authenticated clients may read their own
-- billing row, but cannot insert/update/delete billing state directly.
-- Profile roles are server-managed: users can read their own profile but cannot
-- change role through the Data API.

drop policy if exists "users can create own billing subscription"
on public.billing_subscriptions;

revoke insert, update, delete on public.billing_subscriptions from authenticated, anon;

drop policy if exists "Users can update their own profile"
on public.profiles;

revoke update on public.profiles from authenticated, anon;

-- The legacy application already uses public.posts. Keep it versioned so a fresh
-- environment can reproduce the workspace without relying on an old SQL script.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content text not null,
  topic text,
  source_url text,
  angle text,
  tone text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts
  add column if not exists title text,
  add column if not exists content text,
  add column if not exists topic text,
  add column if not exists source_url text,
  add column if not exists angle text,
  add column if not exists tone text,
  add column if not exists status text not null default 'draft',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.posts enable row level security;

drop policy if exists "users manage own posts" on public.posts;
create policy "users manage own posts"
on public.posts
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.posts to authenticated;

create index if not exists posts_user_created_at_idx
on public.posts(user_id, created_at desc);

create or replace function public.set_posts_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
before update on public.posts
for each row
execute function public.set_posts_updated_at();
