create table if not exists public.commentcraft_posts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_url text, author_name text, post_text text not null, status text not null default 'new', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.commentcraft_comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.commentcraft_posts(id) on delete cascade,
 comment_text text not null, angle text, preset text, status text not null default 'draft', published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.commentcraft_posts enable row level security;
alter table public.commentcraft_comments enable row level security;
create policy "users manage own commentcraft posts" on public.commentcraft_posts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users manage own commentcraft comments" on public.commentcraft_comments for all using (exists(select 1 from public.commentcraft_posts p where p.id=post_id and p.user_id=auth.uid())) with check (exists(select 1 from public.commentcraft_posts p where p.id=post_id and p.user_id=auth.uid()));


create table if not exists public.postcraft_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linkedin_post_id text,
  source_url text,
  source_title text,
  post_text text not null,
  content_hash text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists postcraft_publications_user_source_idx on public.postcraft_publications(user_id, source_url);
create index if not exists postcraft_publications_user_hash_idx on public.postcraft_publications(user_id, content_hash);
alter table public.postcraft_publications enable row level security;
create policy "users manage own postcraft publications" on public.postcraft_publications for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table if not exists public.postcraft_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  publish_time text not null default '08:00',
  timezone text not null default 'Asia/Kolkata',
  mode text not null default 'review' check (mode in ('review','automatic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.postcraft_daily_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_date date not null,
  status text not null default 'ready' check (status in ('generating','ready','editing','scheduled','publishing','published','failed','discarded')),
  source_url text,
  source_title text,
  source_name text,
  generated_post text,
  working_post text,
  recommended_angle text,
  angle_why text,
  ranking_reason text,
  candidate_count integer,
  verification_status text,
  linkedin_post_id text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, draft_date)
);

alter table public.postcraft_schedules enable row level security;
alter table public.postcraft_daily_drafts enable row level security;
create policy "users manage own postcraft schedules" on public.postcraft_schedules for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users manage own postcraft daily drafts" on public.postcraft_daily_drafts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
