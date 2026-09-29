-- Monthly budget plans, and categories that can be added and hidden.
-- Same access model as the rest: signed-in users only, live via Realtime.
--
-- Safe to deploy the app before running this: the app treats a missing
-- `budgets` table as "no plans yet" and a missing `archived` column as
-- "nothing hidden".

/* ---------- one plan per month ---------- */
-- A month's own numbers: what we expect to earn, what we mean to put aside,
-- and a limit per category. Months differ (holidays, insurance, gifts), so
-- the limits live here; categories.monthly_limit is only the default a month
-- without a plan falls back to.
create table if not exists public.budgets (
  month      text primary key check (month ~ '^\d{4}-\d{2}$'),
  income     numeric(12, 2) not null default 0 check (income >= 0),
  savings    numeric(12, 2) not null default 0 check (savings >= 0),
  -- { "<category uuid>": amount } — one row per month keeps a save atomic
  limits     jsonb       not null default '{}'::jsonb,
  -- what's unusual about the month ("car insurance in March"), in the users' words
  note       text,
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

drop policy if exists "signed in full access budgets" on public.budgets;
create policy "signed in full access budgets" on public.budgets
  for all to authenticated using (true) with check (true);

alter table public.budgets replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.budgets';
exception when duplicate_object then null;
end $$;

/* ---------- hiding categories ---------- */
-- Expenses reference their category (on delete restrict), so a category that
-- was ever used can't be deleted without losing history. Hiding it takes it
-- off the Add screen and out of planning, while old expenses keep their name.
alter table public.categories
  add column if not exists archived boolean not null default false;
