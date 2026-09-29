-- Setting up from inside the app.
--
-- 1. One account per budget. The first account is made on the app's welcome
--    screen (/api/setup); after that the database refuses any other, however
--    it's asked: a sign-up with the public key, the dashboard, the admin API.
--    A new Supabase project allows sign-ups, and every signed-in user sees the
--    whole budget, so without this anyone with the site's URL could make an
--    account and read it. To allow a second account after all:
--      drop trigger one_household_account on auth.users;
--
-- 2. Secrets the app keeps for itself, for now the Gemini key typed in
--    Settings → AI. Row level security is on and there is no policy, so only
--    the server functions (service role key) can read or write them; the
--    signed-in app can't, not even its own key.

create or replace function public.one_household_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'This budget already has its account'
      using errcode = 'P0001', hint = 'Sign in with the existing account.';
  end if;
  return new;
end;
$$;

revoke all on function public.one_household_account() from public, anon, authenticated;

drop trigger if exists one_household_account on auth.users;
create trigger one_household_account
  before insert on auth.users
  for each row execute function public.one_household_account();

create table if not exists public.app_secrets (
  name       text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
