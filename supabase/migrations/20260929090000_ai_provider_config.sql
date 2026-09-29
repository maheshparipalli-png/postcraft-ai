create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('ollama','freellmapi','openai','anthropic','google','custom')),
  base_url text,
  model text not null,
  encrypted_api_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_provider_configs_one_active_idx
  on public.ai_provider_configs (is_active)
  where is_active = true;

alter table public.ai_provider_configs enable row level security;
