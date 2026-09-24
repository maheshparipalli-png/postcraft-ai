-- PostCard motivational quote pool and per-user 90-day reuse protection.

create table if not exists public.postcard_quote_pool (
  quote_hash text primary key,
  quote_text text not null,
  author text not null default '',
  category text not null default 'general',
  source text not null default 'ZenQuotes',
  fetched_at timestamptz not null default now()
);

create index if not exists postcard_quote_pool_category_idx
  on public.postcard_quote_pool(category, fetched_at desc);

create table if not exists public.postcard_quote_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_hash text not null references public.postcard_quote_pool(quote_hash) on delete cascade,
  used_at timestamptz not null default now(),
  cooldown_until timestamptz not null default (now() + interval '90 days'),
  action text not null default 'saved',
  primary key (user_id, quote_hash)
);

create index if not exists postcard_quote_usage_user_cooldown_idx
  on public.postcard_quote_usage(user_id, cooldown_until);

alter table public.postcard_quote_pool enable row level security;
alter table public.postcard_quote_usage enable row level security;

drop policy if exists "users can view own postcard quote usage" on public.postcard_quote_usage;
create policy "users can view own postcard quote usage"
on public.postcard_quote_usage for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.postcard_quote_usage to authenticated;
grant select on public.postcard_quote_pool to authenticated;

alter table public.postcard_cards
  add column if not exists quote_hash text,
  add column if not exists quote_text text,
  add column if not exists quote_author text,
  add column if not exists quote_source text,
  add column if not exists quote_category text;

create index if not exists postcard_cards_user_quote_hash_idx
  on public.postcard_cards(user_id, quote_hash);
