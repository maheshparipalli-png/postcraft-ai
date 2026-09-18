-- Account-level saved PostCard designs
create table if not exists public.postcard_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template text not null default 'editorial',
  background text not null default 'paper',
  name text not null default '',
  handle text not null default '',
  photo_data_url text,
  headline text not null default '',
  body text not null default '',
  closing text not null default '',
  stat text not null default '',
  stat_label text not null default '',
  source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.postcard_cards enable row level security;

drop policy if exists "Users can view their own PostCard cards" on public.postcard_cards;
create policy "Users can view their own PostCard cards"
on public.postcard_cards for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own PostCard cards" on public.postcard_cards;
create policy "Users can create their own PostCard cards"
on public.postcard_cards for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own PostCard cards" on public.postcard_cards;
create policy "Users can update their own PostCard cards"
on public.postcard_cards for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own PostCard cards" on public.postcard_cards;
create policy "Users can delete their own PostCard cards"
on public.postcard_cards for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.postcard_cards to authenticated;
