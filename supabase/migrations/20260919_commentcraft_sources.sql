-- CommentCraft watchlist
create table if not exists public.commentcraft_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  label text not null default '',
  active boolean not null default true,
  last_checked_at timestamptz,
  last_seen_key text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, url)
);

alter table public.commentcraft_sources enable row level security;

drop policy if exists "Users can view their own CommentCraft sources" on public.commentcraft_sources;
create policy "Users can view their own CommentCraft sources" on public.commentcraft_sources for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own CommentCraft sources" on public.commentcraft_sources;
create policy "Users can create their own CommentCraft sources" on public.commentcraft_sources for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own CommentCraft sources" on public.commentcraft_sources;
create policy "Users can update their own CommentCraft sources" on public.commentcraft_sources for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own CommentCraft sources" on public.commentcraft_sources;
create policy "Users can delete their own CommentCraft sources" on public.commentcraft_sources for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.commentcraft_sources to authenticated;
