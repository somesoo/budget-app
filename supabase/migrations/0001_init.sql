-- Shared budget for two — V1 schema
-- Note: the app has no login, so every operation runs as the `anon` role.
-- The only thing protecting the data is not knowing the project URL and anon key.

create extension if not exists "pgcrypto";

/* ---------- categories ---------- */
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  color         text        not null default '#64748b',
  monthly_limit numeric(10, 2) not null default 0 check (monthly_limit >= 0),
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now()
);

/* ---------- expenses ---------- */
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(10, 2) not null check (amount > 0),
  category_id  uuid        not null references public.categories (id) on delete restrict,
  -- keys match PERSON_LABELS in src/config.ts
  person       text        not null check (person in ('bubs', 'meow')),
  note         text,
  expense_date date        not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_category_idx on public.expenses (category_id);

/* ---------- savings goal ---------- */
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  target_amount  numeric(10, 2) not null default 0 check (target_amount >= 0),
  current_amount numeric(10, 2) not null default 0 check (current_amount >= 0),
  created_at     timestamptz not null default now()
);

/* ---------- RLS: open to the anon key (no login in V1) ---------- */
alter table public.categories enable row level security;
alter table public.expenses   enable row level security;
alter table public.goals      enable row level security;

drop policy if exists "anon full access categories" on public.categories;
create policy "anon full access categories" on public.categories
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access expenses" on public.expenses;
create policy "anon full access expenses" on public.expenses
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access goals" on public.goals;
create policy "anon full access goals" on public.goals
  for all to anon, authenticated using (true) with check (true);

/* ---------- Realtime ---------- */
-- full row image on UPDATE/DELETE so the client knows what changed
alter table public.categories replica identity full;
alter table public.expenses   replica identity full;
alter table public.goals      replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.categories';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.expenses';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.goals';
exception when duplicate_object then null;
end $$;
