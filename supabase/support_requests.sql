-- Support requests submitted by authenticated users.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 80),
  subject text not null check (char_length(subject) between 2 and 200),
  email text not null check (char_length(email) between 3 and 320),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;

create policy "users can submit own support requests"
on public.support_requests
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can view own support requests"
on public.support_requests
for select
to authenticated
using (auth.uid() = user_id);
