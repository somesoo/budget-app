-- Borrowing from yourselves.
--
-- Taking money out of savings for a need that can't wait is a loan from a goal
-- (or from what's unassigned on an account), paid back in instalments that the
-- monthly plan picks up. The loan records what was taken and where it goes
-- back to; what's been paid back is the sum of the deposits marked with its id.
--
-- Same access model as the rest: signed-in users only, live via Realtime.
-- Safe to deploy the app before running this; borrowing then stays hidden.

create table if not exists public.savings_loans (
  id         uuid primary key default gen_random_uuid(),
  -- where the money came from, and goes back to
  account_id uuid        not null references public.savings_accounts (id) on delete cascade,
  goal_id    uuid        references public.goals (id) on delete set null,
  amount     numeric(12, 2) not null check (amount > 0),
  -- the instalment each month's plan pays back
  monthly    numeric(12, 2) not null check (monthly > 0),
  note       text        not null check (length(note) between 1 and 120),
  created_at timestamptz not null default now()
);

-- a repayment is an ordinary deposit, marked with the loan it pays back
alter table public.savings_movements
  add column if not exists loan_id uuid references public.savings_loans (id) on delete set null;

alter table public.savings_loans enable row level security;

drop policy if exists "signed in full access savings_loans" on public.savings_loans;
create policy "signed in full access savings_loans" on public.savings_loans
  for all to authenticated using (true) with check (true);

alter table public.savings_loans replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.savings_loans';
exception when duplicate_object then null;
end $$;
