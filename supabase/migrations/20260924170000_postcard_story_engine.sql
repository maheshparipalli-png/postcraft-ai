-- PostCard motivational story/source engine.
-- Stores feed items as source material and prevents per-user story reuse for 90 days.

create table if not exists public.postcard_story_pool (
  story_hash text primary key,
  source_title text not null,
  source_url text not null,
  source_name text not null,
  source_summary text not null default '',
  source_published_at timestamptz,
  category text not null default 'general',
  fetched_at timestamptz not null default now()
);

create index if not exists postcard_story_pool_category_idx
  on public.postcard_story_pool(category, fetched_at desc);

create table if not exists public.postcard_story_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_hash text not null references public.postcard_story_pool(story_hash) on delete cascade,
  used_at timestamptz not null default now(),
  cooldown_until timestamptz not null default (now() + interval '90 days'),
  action text not null default 'saved',
  primary key (user_id, story_hash)
);

create index if not exists postcard_story_usage_user_cooldown_idx
  on public.postcard_story_usage(user_id, cooldown_until);

alter table public.postcard_story_pool enable row level security;
alter table public.postcard_story_usage enable row level security;

drop policy if exists "users can view own postcard story usage"
  on public.postcard_story_usage;

create policy "users can view own postcard story usage"
on public.postcard_story_usage
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can record own postcard story usage"
  on public.postcard_story_usage;

create policy "users can record own postcard story usage"
on public.postcard_story_usage
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own postcard story usage"
  on public.postcard_story_usage;

create policy "users can update own postcard story usage"
on public.postcard_story_usage
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select on public.postcard_story_usage to authenticated;
grant select on public.postcard_story_pool to authenticated;

alter table public.postcard_cards
  add column if not exists story_hash text,
  add column if not exists story_source_name text,
  add column if not exists story_source_title text,
  add column if not exists story_source_url text,
  add column if not exists story_category text;

create index if not exists postcard_cards_user_story_hash_idx
  on public.postcard_cards(user_id, story_hash);
