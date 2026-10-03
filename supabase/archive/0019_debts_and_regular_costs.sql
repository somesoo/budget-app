-- Debts, regular costs, and two more kinds of savings account.
--
-- For an install made before these became part of 1.0.0 (supabase/schema.sql
-- has them already). Safe to run more than once.
--
-- 1. Debts: a mortgage, a loan, a credit card, instalments. What's owed is a
--    series of balances (debt_balances), one per update, so the app can draw
--    how it went down and how much is owed at any month's end (net worth).
-- 2. Regular costs: subscriptions and bills that come back every 1, 2, 3, 6
--    or 12 months. due_on is one date it's due; the app works out the next
--    ones. A goal can be the fund the rarer bills are paid from.
-- 3. Savings accounts can be PPK or treasury bonds.

/* ---------- debts ---------- */
create table if not exists public.debts (
  id              uuid        not null default gen_random_uuid(),
  name            text        not null,
  kind            text        not null default 'loan',
  owner           text        not null default 'joint',
  interest_rate   numeric(5, 2),
  monthly_payment numeric(12, 2) not null default 0,
  color           text        not null default '#d95926',
  sort_order      integer     not null default 0,
  archived        boolean     not null default false,
  note            text,
  created_at      timestamptz not null default now(),
  constraint debts_pkey primary key (id),
  constraint debts_name_check check (length(name) >= 1 and length(name) <= 60),
  constraint debts_kind_check check (kind in
    ('mortgage', 'loan', 'card', 'installments', 'private', 'other')),
  constraint debts_interest_rate_check
    check (interest_rate is null or (interest_rate >= 0 and interest_rate <= 100)),
  constraint debts_monthly_payment_check check (monthly_payment >= 0)
);

create table if not exists public.debt_balances (
  id           uuid        not null default gen_random_uuid(),
  debt_id      uuid        not null,
  balance_date date        not null default current_date,
  balance      numeric(12, 2) not null,
  note         text,
  created_at   timestamptz not null default now(),
  constraint debt_balances_pkey primary key (id),
  constraint debt_balances_debt_id_fkey foreign key (debt_id)
    references public.debts (id) on delete cascade,
  constraint debt_balances_balance_check check (balance >= 0)
);

create index if not exists debt_balances_debt_idx
  on public.debt_balances (debt_id, balance_date desc);

/* ---------- regular costs ---------- */
create table if not exists public.recurring_costs (
  id           uuid        not null default gen_random_uuid(),
  name         text        not null,
  kind         text        not null default 'bill',
  amount       numeric(12, 2) not null,
  every_months integer     not null default 1,
  due_on       date        not null,
  category_id  uuid,
  owner        text,
  archived     boolean     not null default false,
  reviewed_on  date,
  note         text,
  created_at   timestamptz not null default now(),
  constraint recurring_costs_pkey primary key (id),
  constraint recurring_costs_category_id_fkey foreign key (category_id)
    references public.categories (id) on delete set null,
  constraint recurring_costs_name_check check (length(name) >= 1 and length(name) <= 60),
  constraint recurring_costs_kind_check check (kind in ('subscription', 'bill')),
  constraint recurring_costs_amount_check check (amount > 0),
  constraint recurring_costs_every_months_check check (every_months in (1, 2, 3, 6, 12))
);

alter table public.goals add column if not exists is_bills_fund boolean not null default false;

/* ---------- PPK and treasury bonds ---------- */
alter table public.savings_accounts drop constraint if exists savings_accounts_kind_check;
alter table public.savings_accounts add constraint savings_accounts_kind_check check (kind in
  ('savings', 'deposit', 'investment', 'retirement', 'ike', 'ikze', 'ppk', 'bonds', 'cash', 'other'));

/* ---------- access and live sync ---------- */
alter table public.debts enable row level security;
drop policy if exists "signed in full access debts" on public.debts;
create policy "signed in full access debts" on public.debts
  for all to authenticated using (true) with check (true);
alter table public.debts replica identity full;

alter table public.debt_balances enable row level security;
drop policy if exists "signed in full access debt_balances" on public.debt_balances;
create policy "signed in full access debt_balances" on public.debt_balances
  for all to authenticated using (true) with check (true);
alter table public.debt_balances replica identity full;

alter table public.recurring_costs enable row level security;
drop policy if exists "signed in full access recurring_costs" on public.recurring_costs;
create policy "signed in full access recurring_costs" on public.recurring_costs
  for all to authenticated using (true) with check (true);
alter table public.recurring_costs replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['debts', 'debt_balances', 'recurring_costs'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
