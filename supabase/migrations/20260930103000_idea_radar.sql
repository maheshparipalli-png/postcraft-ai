-- Idea Radar: insight discovery feed for LinkedIn creators
create table if not exists public.idea_radar_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  category text not null,
  type text not null default 'rss' check (type in ('rss','atom')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idea_radar_feed_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.idea_radar_sources(id) on delete set null,
  canonical_url text not null unique,
  normalized_title text not null,
  title text not null,
  description text,
  source_name text not null,
  source_url text not null,
  published_at timestamptz,
  category text not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idea_radar_feed_items_published_idx
  on public.idea_radar_feed_items(published_at desc);
create index if not exists idea_radar_feed_items_category_idx
  on public.idea_radar_feed_items(category);

create table if not exists public.idea_radar_ideas (
  id uuid primary key default gen_random_uuid(),
  feed_item_id uuid references public.idea_radar_feed_items(id) on delete set null,
  title text not null,
  description text not null,
  why_interesting text not null,
  insight text not null,
  category text not null,
  source_name text not null,
  source_url text not null,
  published_at timestamptz,
  status text not null default 'new' check (status in ('new','reviewed','saved','post_generated','used','hidden')),
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idea_radar_ideas_created_idx
  on public.idea_radar_ideas(created_at desc);
create index if not exists idea_radar_ideas_category_idx
  on public.idea_radar_ideas(category);
create index if not exists idea_radar_ideas_status_idx
  on public.idea_radar_ideas(status);

create table if not exists public.idea_radar_angles (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.idea_radar_ideas(id) on delete cascade,
  angle text not null,
  why text not null,
  evidence text not null,
  created_at timestamptz not null default now(),
  unique (idea_id, angle)
);

create table if not exists public.idea_radar_user_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  idea_id uuid not null references public.idea_radar_ideas(id) on delete cascade,
  action text not null check (action in ('saved','hidden','used','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, idea_id, action)
);

create index if not exists idea_radar_user_actions_user_idx
  on public.idea_radar_user_actions(user_id, updated_at desc);

alter table public.idea_radar_sources enable row level security;
alter table public.idea_radar_feed_items enable row level security;
alter table public.idea_radar_ideas enable row level security;
alter table public.idea_radar_angles enable row level security;
alter table public.idea_radar_user_actions enable row level security;

drop policy if exists "idea radar sources readable by authenticated users" on public.idea_radar_sources;
create policy "idea radar sources readable by authenticated users"
on public.idea_radar_sources for select to authenticated using (true);

drop policy if exists "idea radar feed readable by authenticated users" on public.idea_radar_feed_items;
create policy "idea radar feed readable by authenticated users"
on public.idea_radar_feed_items for select to authenticated using (true);

drop policy if exists "idea radar ideas readable by authenticated users" on public.idea_radar_ideas;
create policy "idea radar ideas readable by authenticated users"
on public.idea_radar_ideas for select to authenticated using (true);

drop policy if exists "idea radar angles readable by authenticated users" on public.idea_radar_angles;
create policy "idea radar angles readable by authenticated users"
on public.idea_radar_angles for select to authenticated using (true);

drop policy if exists "idea radar actions own rows" on public.idea_radar_user_actions;
create policy "idea radar actions own rows"
on public.idea_radar_user_actions for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.idea_radar_sources (name,url,category,type)
values
  ('MIT Technology Review','https://www.technologyreview.com/feed/','AI & Technology','rss'),
  ('Harvard Business Review','https://feeds.hbr.org/harvardbusiness','Business','rss'),
  ('McKinsey Insights','https://www.mckinsey.com/insights/rss','Business','rss'),
  ('Google AI Blog','https://blog.google/technology/ai/rss/','AI & Technology','rss'),
  ('Microsoft Research Blog','https://www.microsoft.com/en-us/research/feed/','AI & Technology','rss'),
  ('Stanford HAI','https://hai.stanford.edu/news/rss.xml','AI & Technology','rss'),
  ('Farnam Street','https://fs.blog/feed/','Psychology','rss'),
  ('James Clear','https://jamesclear.com/feed','Personal Growth','rss'),
  ('HubSpot Marketing','https://blog.hubspot.com/marketing/rss.xml','Marketing','rss')
on conflict (url) do update set
  name = excluded.name,
  category = excluded.category,
  type = excluded.type,
  updated_at = now();
