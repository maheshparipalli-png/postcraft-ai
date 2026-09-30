create table if not exists public.ai_image_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('freellmapi','openai')),
  base_url text,
  model text not null,
  encrypted_api_key text,
  priority integer not null default 100,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);

create index if not exists ai_image_provider_configs_priority_idx
  on public.ai_image_provider_configs(is_enabled, priority);

alter table public.ai_image_provider_configs enable row level security;
