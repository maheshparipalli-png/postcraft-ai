create table if not exists public.postcraft_daily_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_date date not null,
  status text not null default 'ready' check (status in ('ready', 'editing', 'scheduled', 'publishing', 'published')),
  source_url text not null,
  source_title text not null,
  source_name text,
  generated_post text not null,
  working_post text not null,
  recommended_angle text,
  angle_why text,
  ranking_reason text,
  candidate_count integer,
  verification_status text,
  linkedin_post_id text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, draft_date)
);

create index if not exists postcraft_daily_drafts_user_date_idx
  on public.postcraft_daily_drafts (user_id, draft_date);

alter table public.postcraft_daily_drafts enable row level security;

drop policy if exists "users manage own daily drafts" on public.postcraft_daily_drafts;
create policy "users manage own daily drafts"
on public.postcraft_daily_drafts
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
