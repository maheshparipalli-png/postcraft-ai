-- Admin account controls: explicit suspension state.
alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended'));

create index if not exists profiles_account_status_idx
  on public.profiles(account_status);

-- Users should not be able to mutate their own role or account status.
-- Profile edits are not currently required by the application; keep profile
-- mutations server-authorized until a field-specific update path is added.
drop policy if exists "Users can update their own profile" on public.profiles;
