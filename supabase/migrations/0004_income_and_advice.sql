-- Income (paychecks) and stored AI recommendations.
-- Same access model as the rest: signed-in users only, live via Realtime.

/* ---------- income ---------- */
create table if not exists public.incomes (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(12, 2) not null check (amount > 0),
  -- keys match PERSON_LABELS in src/config.ts
  person      text        not null check (person in ('bubs', 'meow')),
  note        text,
  income_date date        not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists incomes_date_idx on public.incomes (income_date desc);

/* ---------- recommendations ---------- */
-- One row per generated set, so both phones see the same advice and the
-- Gemini call isn't repeated every time someone opens the tab.
create table if not exists public.advice (
  id         uuid primary key default gen_random_uuid(),
  month      text        not null check (month ~ '^\d{4}-\d{2}$'),
  content    jsonb       not null,
  created_at timestamptz not null default now()
);

create index if not exists advice_month_idx on public.advice (month, created_at desc);

/* ---------- access ---------- */
alter table public.incomes enable row level security;
alter table public.advice  enable row level security;

drop policy if exists "signed in full access incomes" on public.incomes;
create policy "signed in full access incomes" on public.incomes
  for all to authenticated using (true) with check (true);

drop policy if exists "signed in full access advice" on public.advice;
create policy "signed in full access advice" on public.advice
  for all to authenticated using (true) with check (true);

/* ---------- realtime ---------- */
alter table public.incomes replica identity full;
alter table public.advice  replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.incomes';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.advice';
exception when duplicate_object then null;
end $$;
