-- The whole database of version 1.0.0, in one file.
--
-- A new install runs this once (scripts/migrate.mjs does it on the first
-- deploy); later changes come as files in supabase/migrations, which run on
-- top of it. It's the same database that migrations 0001–0019 (now in
-- supabase/archive) build step by step, without the detours: no anonymous
-- access that's taken away again, no fixed Bubs and Meow, no single goal that
-- turns into accounts.
--
-- Access model: every table is open to a signed-in user and closed to
-- everyone else (the public key in the app's bundle can't read anything on
-- its own). There is one account per budget, made on the app's welcome
-- screen; the database refuses any other (see "one account", at the end).
-- Every table the app shows is in the supabase_realtime publication, so a
-- change on one phone shows on the others straight away.
--
-- Amounts are złoty, numeric with two decimals. Months are 'YYYY-MM' text.
-- Who did something (person, owner) is an id from the people table.

create extension if not exists "pgcrypto";


/* ======================================================================
   People and categories
   ====================================================================== */

-- One to four people, named on the first launch. The id is what other tables
-- store (made from the name: 'anna', 'lukasz-zak'), the name is only shown,
-- so a rename touches nothing else.
create table public.people (
  id         text        not null,
  name       text        not null,
  color      text        not null default '#3987e5',
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  constraint people_pkey primary key (id),
  constraint people_color_check check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint people_id_check check (id ~ '^[a-z0-9-]{1,24}$'),
  constraint people_name_check check (char_length(btrim(name)) between 1 and 30)
);

-- Goals: what money is saved for (a trip, an emergency fund). Each one has a
-- category of kind 'project' that is kept in step with it (trigger below),
-- so it can be spent from on the Add tab. current_amount is from before
-- savings accounts and no longer used; the money is in goal_allocations.
create table public.goals (
  id             uuid        not null default gen_random_uuid(),
  name           text        not null,
  target_amount  numeric(10, 2) not null default 0,
  current_amount numeric(10, 2) not null default 0,
  created_at     timestamptz not null default now(),
  target_date    date,
  color          text        not null default '#3987e5',
  sort_order     integer     not null default 0,
  archived       boolean     not null default false,
  note           text,
  -- the emergency fund, which the Budget tab's health check looks at
  is_emergency   boolean     not null default false,
  -- the fund the rarer regular bills are paid from (recurring_costs)
  is_bills_fund  boolean     not null default false,
  constraint goals_pkey primary key (id),
  constraint goals_current_amount_check check (current_amount >= 0),
  constraint goals_target_amount_check check (target_amount >= 0)
);

-- Categories: 'monthly' ones have a limit per month (overridden per month by
-- a plan in budgets); a 'project' is a goal's, with a total budget instead
-- and outside the monthly figures. owner makes it one person's allowance.
create table public.categories (
  id            uuid        not null default gen_random_uuid(),
  name          text        not null,
  color         text        not null default '#64748b',
  monthly_limit numeric(10, 2) not null default 0,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  archived      boolean     not null default false,
  -- false leaves it out of the "Where it goes" donut
  show_in_chart boolean     not null default true,
  kind          text        not null default 'monthly',
  budget_total  numeric(12, 2),
  starts_on     date,
  ends_on       date,
  goal_id       uuid,
  owner         text,
  constraint categories_pkey primary key (id),
  constraint categories_goal_id_fkey foreign key (goal_id)
    references public.goals (id) on delete set null,
  constraint categories_budget_total_check check (budget_total is null or budget_total >= 0),
  constraint categories_kind_check check (kind in ('monthly', 'project')),
  constraint categories_monthly_limit_check check (monthly_limit >= 0)
);


/* ======================================================================
   Money in and out
   ====================================================================== */

create table public.expenses (
  id           uuid        not null default gen_random_uuid(),
  amount       numeric(10, 2) not null,
  category_id  uuid        not null,
  person       text        not null,
  note         text,
  expense_date date        not null default current_date,
  created_at   timestamptz not null default now(),
  constraint expenses_pkey primary key (id),
  constraint expenses_category_id_fkey foreign key (category_id)
    references public.categories (id) on delete restrict,
  constraint expenses_amount_check check (amount > 0)
);

create index expenses_date_idx on public.expenses (expense_date desc);
create index expenses_category_idx on public.expenses (category_id);

-- Pay and other money in. for_month files it under another month (December's
-- pay that arrives on 28 November); one_off keeps it out of the typical pay
-- the planner and forecast expect (a returned deposit, something sold).
create table public.incomes (
  id          uuid        not null default gen_random_uuid(),
  amount      numeric(12, 2) not null,
  person      text        not null,
  note        text,
  income_date date        not null default current_date,
  created_at  timestamptz not null default now(),
  for_month   text,
  one_off     boolean     not null default false,
  constraint incomes_pkey primary key (id),
  constraint incomes_amount_check check (amount > 0),
  constraint incomes_for_month_check check (for_month ~ '^\d{4}-\d{2}$')
);

create index incomes_date_idx on public.incomes (income_date desc);


/* ======================================================================
   Plans
   ====================================================================== */

-- A month's plan: expected income, what to put aside and how it's split
-- between goals and IKE/IKZE (allocations), a limit per category (limits:
-- category id → amount), and where the month before's leftover goes
-- (carryover, after keeping carryover_keep on the account).
create table public.budgets (
  month          text        not null,
  income         numeric(12, 2) not null default 0,
  savings        numeric(12, 2) not null default 0,
  limits         jsonb       not null default '{}'::jsonb,
  note           text,
  updated_at     timestamptz not null default now(),
  allocations    jsonb       not null default '[]'::jsonb,
  carryover      jsonb,
  carryover_keep numeric(12, 2) not null default 0,
  constraint budgets_pkey primary key (month),
  constraint budgets_carryover_keep_check check (carryover_keep >= 0),
  constraint budgets_income_check check (income >= 0),
  constraint budgets_month_check check (month ~ '^\d{4}-\d{2}$'),
  constraint budgets_savings_check check (savings >= 0)
);


/* ======================================================================
   Regular costs
   ====================================================================== */

-- Subscriptions and bills that come back every 1, 2, 3, 6 or 12 months.
-- due_on is one date it's due; the app works out the next ones from it. The
-- rarer ones (every 2+ months) are what a bills fund (goals.is_bills_fund)
-- puts money aside for; reviewed_on is when a subscription was last checked
-- as still wanted.
create table public.recurring_costs (
  id           uuid        not null default gen_random_uuid(),
  name         text        not null,
  kind         text        not null default 'bill',
  amount       numeric(12, 2) not null,
  every_months integer     not null default 1,
  due_on       date        not null,
  category_id  uuid,
  -- a person's id when it's theirs; null when it's shared
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


/* ======================================================================
   Savings
   ====================================================================== */

-- An account is WHERE money is (a savings account, a deposit, IKE, cash); its
-- balance is the sum of its movements. A goal is WHAT it's for; an
-- allocation assigns part of an account's balance to a goal, and whatever
-- isn't assigned is "unassigned". Money moves only through the functions
-- below, which lock the account first, so two phones at once can't push the
-- allocations past the balance.
create table public.savings_accounts (
  id            uuid        not null default gen_random_uuid(),
  name          text        not null,
  kind          text        not null default 'savings',
  -- a person's id, or 'joint'
  owner         text        not null default 'joint',
  -- yearly, in percent; null when it doesn't earn interest
  interest_rate numeric(5, 2),
  color         text        not null default '#3987e5',
  sort_order    integer     not null default 0,
  archived      boolean     not null default false,
  note          text,
  created_at    timestamptz not null default now(),
  constraint savings_accounts_pkey primary key (id),
  constraint savings_accounts_interest_rate_check
    check (interest_rate is null or (interest_rate >= 0 and interest_rate <= 100)),
  constraint savings_accounts_kind_check check (kind in
    ('savings', 'deposit', 'investment', 'retirement', 'ike', 'ikze', 'ppk', 'bonds', 'cash', 'other')),
  constraint savings_accounts_name_check check (length(name) >= 1 and length(name) <= 60)
);

-- Borrowing from savings, paid back in monthly instalments (movements with
-- this loan_id).
create table public.savings_loans (
  id         uuid        not null default gen_random_uuid(),
  account_id uuid        not null,
  goal_id    uuid,
  amount     numeric(12, 2) not null,
  monthly    numeric(12, 2) not null,
  note       text        not null,
  created_at timestamptz not null default now(),
  constraint savings_loans_pkey primary key (id),
  constraint savings_loans_account_id_fkey foreign key (account_id)
    references public.savings_accounts (id) on delete cascade,
  constraint savings_loans_goal_id_fkey foreign key (goal_id)
    references public.goals (id) on delete set null,
  constraint savings_loans_amount_check check (amount > 0),
  constraint savings_loans_monthly_check check (monthly > 0),
  constraint savings_loans_note_check check (length(note) >= 1 and length(note) <= 120)
);

-- Signed: money in is positive, out negative. A transfer is a pair of
-- 'transfer' rows sharing a transfer_id. 'spending' is an expense paid from a
-- goal, kept in step with that expense by the triggers below (expense_id).
create table public.savings_movements (
  id            uuid        not null default gen_random_uuid(),
  account_id    uuid        not null,
  kind          text        not null,
  amount        numeric(12, 2) not null,
  movement_date date        not null default current_date,
  person        text,
  note          text,
  goal_id       uuid,
  transfer_id   uuid,
  created_at    timestamptz not null default now(),
  loan_id       uuid,
  expense_id    uuid,
  constraint savings_movements_pkey primary key (id),
  constraint savings_movements_account_id_fkey foreign key (account_id)
    references public.savings_accounts (id) on delete cascade,
  constraint savings_movements_goal_id_fkey foreign key (goal_id)
    references public.goals (id) on delete set null,
  constraint savings_movements_loan_id_fkey foreign key (loan_id)
    references public.savings_loans (id) on delete set null,
  constraint savings_movements_expense_id_fkey foreign key (expense_id)
    references public.expenses (id) on delete cascade,
  constraint savings_movements_amount_check check (amount <> 0),
  constraint savings_movements_kind_check check (kind in
    ('deposit', 'withdrawal', 'interest', 'adjustment', 'transfer', 'spending')),
  constraint savings_movements_sign_check check (
    (kind = 'deposit' and amount > 0)
    or (kind in ('withdrawal', 'spending') and amount < 0)
    or kind in ('interest', 'adjustment', 'transfer')),
  constraint savings_movements_spending_check check ((kind = 'spending') = (expense_id is not null))
);

create index savings_movements_account_idx
  on public.savings_movements (account_id, movement_date desc);
create index savings_movements_expense_idx
  on public.savings_movements (expense_id) where expense_id is not null;

create table public.goal_allocations (
  account_id uuid        not null,
  goal_id    uuid        not null,
  amount     numeric(12, 2) not null,
  updated_at timestamptz not null default now(),
  constraint goal_allocations_pkey primary key (account_id, goal_id),
  constraint goal_allocations_account_id_fkey foreign key (account_id)
    references public.savings_accounts (id) on delete cascade,
  constraint goal_allocations_goal_id_fkey foreign key (goal_id)
    references public.goals (id) on delete cascade,
  constraint goal_allocations_amount_check check (amount > 0)
);

/* ---------- reading balances ---------- */

create function public.savings_balance(acc uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(amount), 0) from public.savings_movements where account_id = acc;
$$;

create function public.savings_allocated(acc uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(amount), 0) from public.goal_allocations where account_id = acc;
$$;

/* ---------- internals: locking and moving shares ---------- */

create function public._lock_account(acc uuid)
returns void
language plpgsql
as $$
begin
  perform 1 from public.savings_accounts where id = acc for update;
  if not found then
    raise exception 'No such account';
  end if;
end $$;

-- Moves a goal's share on an account by delta; a share of 0 is removed.
create function public._shift_allocation(acc uuid, goal uuid, delta numeric)
returns void
language plpgsql
as $$
declare
  next numeric;
begin
  select coalesce((select amount from public.goal_allocations
                   where account_id = acc and goal_id = goal), 0) + delta
  into next;
  if next < 0 then
    raise exception 'That goal only has % on this account', next - delta;
  end if;
  if next = 0 then
    delete from public.goal_allocations where account_id = acc and goal_id = goal;
  else
    insert into public.goal_allocations (account_id, goal_id, amount)
    values (acc, goal, next)
    on conflict (account_id, goal_id)
    do update set amount = excluded.amount, updated_at = now();
  end if;
end $$;

/* ---------- what the app calls ---------- */

-- Money into an account (a deposit or interest), optionally for a goal.
create function public.save_to(p_account uuid, p_amount numeric, p_goal uuid default null, p_kind text default 'deposit', p_date date default current_date, p_person text default null, p_note text default null)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'The amount has to be more than zero';
  end if;
  if p_kind not in ('deposit', 'interest') then
    raise exception 'Use save_to for deposits and interest';
  end if;
  perform public._lock_account(p_account);
  insert into public.savings_movements (account_id, kind, amount, movement_date, person, note, goal_id)
  values (p_account, p_kind, p_amount, p_date, p_person, p_note, p_goal)
  returning id into new_id;
  if p_goal is not null then
    perform public._shift_allocation(p_account, p_goal, p_amount);
  end if;
  return new_id;
end $$;

-- Money out of an account: from a goal's share, or from what's unassigned.
create function public.take_from(p_account uuid, p_amount numeric, p_goal uuid default null, p_date date default current_date, p_person text default null, p_note text default null)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
  unassigned numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'The amount has to be more than zero';
  end if;
  perform public._lock_account(p_account);
  if p_amount > public.savings_balance(p_account) then
    raise exception 'There isn''t that much on the account';
  end if;
  if p_goal is null then
    unassigned := public.savings_balance(p_account) - public.savings_allocated(p_account);
    if p_amount > unassigned then
      raise exception 'Only % is unassigned; the rest is set aside for goals, so pick the goal to take it from', unassigned;
    end if;
  else
    perform public._shift_allocation(p_account, p_goal, -p_amount);
  end if;
  insert into public.savings_movements (account_id, kind, amount, movement_date, person, note, goal_id)
  values (p_account, 'withdrawal', -p_amount, p_date, p_person, p_note, p_goal)
  returning id into new_id;
  return new_id;
end $$;

-- "Set balance": books the difference as an adjustment.
create function public.set_balance(p_account uuid, p_balance numeric, p_date date default current_date, p_person text default null, p_note text default null)
returns uuid
language plpgsql
as $$
declare
  diff numeric;
  new_id uuid;
begin
  if p_balance is null or p_balance < 0 then
    raise exception 'The balance can''t be negative';
  end if;
  perform public._lock_account(p_account);
  diff := p_balance - public.savings_balance(p_account);
  if diff = 0 then
    return null;
  end if;
  if p_balance < public.savings_allocated(p_account) then
    raise exception 'Goals hold % on this account; lower their shares first', public.savings_allocated(p_account);
  end if;
  insert into public.savings_movements (account_id, kind, amount, movement_date, person, note)
  values (p_account, 'adjustment', diff, p_date, p_person, coalesce(p_note, 'Balance updated'))
  returning id into new_id;
  return new_id;
end $$;

-- Assigns (delta > 0) or releases (delta < 0) part of an account to a goal.
create function public.allocate(p_account uuid, p_goal uuid, p_delta numeric)
returns void
language plpgsql
as $$
begin
  perform public._lock_account(p_account);
  if p_delta > 0
     and public.savings_allocated(p_account) + p_delta > public.savings_balance(p_account) then
    raise exception 'Only % is unassigned on this account',
      public.savings_balance(p_account) - public.savings_allocated(p_account);
  end if;
  perform public._shift_allocation(p_account, p_goal, p_delta);
end $$;

create function public.transfer(p_from uuid, p_to uuid, p_amount numeric, p_goal uuid default null, p_date date default current_date, p_person text default null, p_note text default null)
returns uuid
language plpgsql
as $$
declare
  pair uuid := gen_random_uuid();
  unassigned numeric;
begin
  if p_from = p_to then
    raise exception 'Pick two different accounts';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'The amount has to be more than zero';
  end if;
  -- always lock in the same order, so two opposite transfers can't deadlock
  perform public._lock_account(least(p_from, p_to));
  perform public._lock_account(greatest(p_from, p_to));
  if p_amount > public.savings_balance(p_from) then
    raise exception 'There isn''t that much on the account';
  end if;
  if p_goal is null then
    unassigned := public.savings_balance(p_from) - public.savings_allocated(p_from);
    if p_amount > unassigned then
      raise exception 'Only % is unassigned; the rest is set aside for goals, so pick the goal to move', unassigned;
    end if;
  else
    perform public._shift_allocation(p_from, p_goal, -p_amount);
    perform public._shift_allocation(p_to, p_goal, p_amount);
  end if;
  insert into public.savings_movements (account_id, kind, amount, movement_date, person, note, goal_id, transfer_id)
  values
    (p_from, 'transfer', -p_amount, p_date, p_person, p_note, p_goal, pair),
    (p_to,   'transfer',  p_amount, p_date, p_person, p_note, p_goal, pair);
  return pair;
end $$;

-- Undoes a movement (both halves of a transfer), then trims any goal shares
-- the account can no longer cover. Spending from a goal is undone by
-- changing or deleting its expense instead.
create function public.delete_movement(p_id uuid)
returns void
language plpgsql
as $$
declare
  m record;
  accounts uuid[];
  acc uuid;
  src uuid;
  dst uuid;
  back numeric;
  excess numeric;
  a record;
  cut numeric;
begin
  select * into m from public.savings_movements where id = p_id;
  if not found then
    return;
  end if;
  if m.expense_id is not null then
    raise exception 'This was spent from a goal; change or delete the expense instead';
  end if;
  select array_agg(distinct account_id order by account_id) into accounts
  from public.savings_movements
  where id = p_id or (m.transfer_id is not null and transfer_id = m.transfer_id);
  foreach acc in array accounts loop
    perform public._lock_account(acc);
  end loop;

  if m.transfer_id is not null and m.goal_id is not null then
    select account_id into src from public.savings_movements
    where transfer_id = m.transfer_id and amount < 0;
    select account_id into dst from public.savings_movements
    where transfer_id = m.transfer_id and amount > 0;
    select least(abs(m.amount), coalesce((select amount from public.goal_allocations
                                          where account_id = dst and goal_id = m.goal_id), 0))
    into back;
    if back > 0 then
      perform public._shift_allocation(dst, m.goal_id, -back);
      perform public._shift_allocation(src, m.goal_id, back);
    end if;
  end if;

  delete from public.savings_movements
  where id = p_id or (m.transfer_id is not null and transfer_id = m.transfer_id);

  foreach acc in array accounts loop
    excess := public.savings_allocated(acc) - greatest(public.savings_balance(acc), 0);
    continue when excess <= 0;
    for a in
      select goal_id, amount from public.goal_allocations
      where account_id = acc
      order by (goal_id = m.goal_id) desc nulls last, amount desc
    loop
      exit when excess <= 0;
      cut := least(a.amount, excess);
      perform public._shift_allocation(acc, a.goal_id, -cut);
      excess := excess - cut;
    end loop;
  end loop;
end $$;

-- From before savings accounts; kept for an app that still calls it.
create function public.add_to_goal(goal_id uuid, delta numeric)
returns public.goals
language sql
as $$
  update public.goals
  set current_amount = greatest(current_amount + delta, 0)
  where id = goal_id
  returning *;
$$;

/* ---------- goals are spendable categories ---------- */

create function public._goal_to_category()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.categories where goal_id = new.id) then
      insert into public.categories
        (name, color, monthly_limit, kind, budget_total, goal_id, archived, sort_order)
      values (
        new.name, new.color, 0, 'project', nullif(new.target_amount, 0), new.id, new.archived,
        coalesce((select max(sort_order) + 1 from public.categories), 0)
      );
    end if;
  else
    update public.categories
    set name = new.name,
        color = new.color,
        archived = new.archived,
        budget_total = nullif(new.target_amount, 0)
    where goal_id = new.id and kind = 'project';
  end if;
  return new;
end $$;

create trigger goal_to_category_insert
  after insert on public.goals
  for each row execute function public._goal_to_category();
create trigger goal_to_category_update
  after update of name, color, archived, target_amount on public.goals
  for each row execute function public._goal_to_category();

/* ---------- spending from a goal takes it off the account ---------- */

-- Out of the goal's shares, the biggest first; if the goal has less, the
-- rest from what's unassigned on the accounts it uses (the last used first).
-- What can't be covered is left, and the goal shows it as overspent.
create function public._spend_expense(p_expense uuid, p_category uuid, p_amount numeric, p_date date, p_person text, p_note text)
returns void
language plpgsql
as $$
declare
  goal uuid;
  label text;
  left_over numeric := p_amount;
  acc uuid;
  a record;
  take numeric;
begin
  select c.goal_id, coalesce(nullif(btrim(p_note), ''), c.name)
  into goal, label
  from public.categories c
  where c.id = p_category;
  if goal is null or p_amount is null or p_amount <= 0 then
    return;
  end if;

  -- every account it could come from, locked in one order so two phones
  -- can't deadlock
  for acc in
    select account_id from public.goal_allocations where goal_id = goal
    union
    select account_id from public.savings_movements where goal_id = goal
    order by 1
  loop
    perform public._lock_account(acc);
  end loop;

  -- the goal's own money, the biggest share first
  for a in
    select account_id, amount from public.goal_allocations
    where goal_id = goal
    order by amount desc, account_id
  loop
    exit when left_over <= 0;
    take := least(a.amount, left_over);
    perform public._shift_allocation(a.account_id, goal, -take);
    insert into public.savings_movements
      (account_id, kind, amount, movement_date, person, note, goal_id, expense_id)
    values (a.account_id, 'spending', -take, p_date, p_person, label, goal, p_expense);
    left_over := left_over - take;
  end loop;

  -- more than the goal had: what's unassigned on the accounts it uses, the
  -- one it used last first
  if left_over > 0 then
    for a in
      select account_id, max(created_at) as last_used
      from public.savings_movements
      where goal_id = goal
      group by account_id
      order by last_used desc
    loop
      exit when left_over <= 0;
      take := least(
        greatest(public.savings_balance(a.account_id) - public.savings_allocated(a.account_id), 0),
        left_over
      );
      continue when take <= 0;
      insert into public.savings_movements
        (account_id, kind, amount, movement_date, person, note, expense_id)
      values (a.account_id, 'spending', -take, p_date, p_person, label, p_expense);
      left_over := left_over - take;
    end loop;
  end if;
end $$;

create function public._unspend_expense(p_expense uuid)
returns void
language plpgsql
as $$
declare
  m record;
begin
  for m in
    select * from public.savings_movements where expense_id = p_expense order by account_id
  loop
    perform public._lock_account(m.account_id);
    if m.goal_id is not null then
      perform public._shift_allocation(m.account_id, m.goal_id, -m.amount);
    end if;
  end loop;
  delete from public.savings_movements where expense_id = p_expense;
end $$;

create function public._expense_to_savings()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public._unspend_expense(old.id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public._spend_expense(
      new.id, new.category_id, new.amount, new.expense_date, new.person, new.note
    );
    return new;
  end if;
  return old;
end $$;

create trigger expense_to_savings_insert
  after insert on public.expenses
  for each row execute function public._expense_to_savings();
create trigger expense_to_savings_update
  after update of amount, category_id, expense_date, person, note on public.expenses
  for each row execute function public._expense_to_savings();
create trigger expense_to_savings_delete
  before delete on public.expenses
  for each row execute function public._expense_to_savings();

-- Signed-in users only; the helpers aren't callable with the public key.
revoke execute on function public.add_to_goal(uuid, numeric) from anon;
revoke execute on function public.savings_balance(uuid) from public, anon;
revoke execute on function public.savings_allocated(uuid) from public, anon;
revoke execute on function public._lock_account(uuid) from public, anon;
revoke execute on function public._shift_allocation(uuid, uuid, numeric) from public, anon;
revoke execute on function public.save_to(uuid, numeric, uuid, text, date, text, text) from public, anon;
revoke execute on function public.take_from(uuid, numeric, uuid, date, text, text) from public, anon;
revoke execute on function public.set_balance(uuid, numeric, date, text, text) from public, anon;
revoke execute on function public.allocate(uuid, uuid, numeric) from public, anon;
revoke execute on function public.transfer(uuid, uuid, numeric, uuid, date, text, text) from public, anon;
revoke execute on function public.delete_movement(uuid) from public, anon;
revoke execute on function public._spend_expense(uuid, uuid, numeric, date, text, text) from public, anon;
revoke execute on function public._unspend_expense(uuid) from public, anon;

grant execute on function public.add_to_goal(uuid, numeric) to authenticated;
grant execute on function public.savings_balance(uuid) to authenticated;
grant execute on function public.savings_allocated(uuid) to authenticated;
grant execute on function public._lock_account(uuid) to authenticated;
grant execute on function public._shift_allocation(uuid, uuid, numeric) to authenticated;
grant execute on function public.save_to(uuid, numeric, uuid, text, date, text, text) to authenticated;
grant execute on function public.take_from(uuid, numeric, uuid, date, text, text) to authenticated;
grant execute on function public.set_balance(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.allocate(uuid, uuid, numeric) to authenticated;
grant execute on function public.transfer(uuid, uuid, numeric, uuid, date, text, text) to authenticated;
grant execute on function public.delete_movement(uuid) to authenticated;
grant execute on function public._spend_expense(uuid, uuid, numeric, date, text, text) to authenticated;
grant execute on function public._unspend_expense(uuid) to authenticated;


/* ======================================================================
   Debts
   ====================================================================== */

-- A mortgage, a loan, a credit card, instalments. What's owed is the latest
-- of its balances; each update adds one, so the app can draw how it went down
-- and say what was owed at any month's end (net worth = savings − debts).
-- The instalment itself is an expense like any other; the balance is updated
-- from it, or from the bank.
create table public.debts (
  id              uuid        not null default gen_random_uuid(),
  name            text        not null,
  kind            text        not null default 'loan',
  -- a person's id, or 'joint'
  owner           text        not null default 'joint',
  -- yearly, in percent; null or 0 for interest-free instalments
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

create table public.debt_balances (
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

create index debt_balances_debt_idx on public.debt_balances (debt_id, balance_date desc);


/* ======================================================================
   AI
   ====================================================================== */

-- Recommendations from /api/advice, shared by every phone.
create table public.advice (
  id         uuid        not null default gen_random_uuid(),
  month      text        not null,
  content    jsonb       not null,
  created_at timestamptz not null default now(),
  constraint advice_pkey primary key (id),
  constraint advice_month_check check (month ~ '^\d{4}-\d{2}$')
);

create index advice_month_idx on public.advice (month, created_at desc);

-- The Ask tab's conversations.
create table public.ai_threads (
  id         uuid        not null default gen_random_uuid(),
  title      text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_threads_pkey primary key (id),
  constraint ai_threads_title_check check (length(title) >= 1 and length(title) <= 120)
);

create index ai_threads_updated_idx on public.ai_threads (updated_at desc);

create table public.ai_messages (
  id         uuid        not null default gen_random_uuid(),
  thread_id  uuid        not null,
  role       text        not null,
  content    text        not null,
  person     text,
  created_at timestamptz not null default now(),
  constraint ai_messages_pkey primary key (id),
  constraint ai_messages_thread_id_fkey foreign key (thread_id)
    references public.ai_threads (id) on delete cascade,
  constraint ai_messages_content_check check (length(content) >= 1 and length(content) <= 20000),
  constraint ai_messages_role_check check (role in ('user', 'assistant'))
);

create index ai_messages_thread_idx on public.ai_messages (thread_id, created_at);

-- Secrets the app keeps for itself, for now the Gemini key typed in
-- Settings → AI. No policy and no grants: only the server functions (service
-- role key) can read or write them, not the signed-in app.
create table public.app_secrets (
  name       text        not null,
  value      text        not null,
  updated_at timestamptz not null default now(),
  constraint app_secrets_pkey primary key (name)
);

revoke all on public.app_secrets from anon, authenticated;


/* ======================================================================
   Access and live sync
   ====================================================================== */

-- Row level security on every table; one policy each: signed in, full access.
-- A whole-row image on update and delete, so Realtime says what changed.

alter table public.people enable row level security;
create policy "signed in full access people" on public.people
  for all to authenticated using (true) with check (true);
alter table public.people replica identity full;

alter table public.goals enable row level security;
create policy "signed in full access goals" on public.goals
  for all to authenticated using (true) with check (true);
alter table public.goals replica identity full;

alter table public.categories enable row level security;
create policy "signed in full access categories" on public.categories
  for all to authenticated using (true) with check (true);
alter table public.categories replica identity full;

alter table public.expenses enable row level security;
create policy "signed in full access expenses" on public.expenses
  for all to authenticated using (true) with check (true);
alter table public.expenses replica identity full;

alter table public.incomes enable row level security;
create policy "signed in full access incomes" on public.incomes
  for all to authenticated using (true) with check (true);
alter table public.incomes replica identity full;

alter table public.budgets enable row level security;
create policy "signed in full access budgets" on public.budgets
  for all to authenticated using (true) with check (true);
alter table public.budgets replica identity full;

alter table public.savings_accounts enable row level security;
create policy "signed in full access savings_accounts" on public.savings_accounts
  for all to authenticated using (true) with check (true);
alter table public.savings_accounts replica identity full;

alter table public.savings_loans enable row level security;
create policy "signed in full access savings_loans" on public.savings_loans
  for all to authenticated using (true) with check (true);
alter table public.savings_loans replica identity full;

alter table public.savings_movements enable row level security;
create policy "signed in full access savings_movements" on public.savings_movements
  for all to authenticated using (true) with check (true);
alter table public.savings_movements replica identity full;

alter table public.goal_allocations enable row level security;
create policy "signed in full access goal_allocations" on public.goal_allocations
  for all to authenticated using (true) with check (true);
alter table public.goal_allocations replica identity full;

alter table public.advice enable row level security;
create policy "signed in full access advice" on public.advice
  for all to authenticated using (true) with check (true);
alter table public.advice replica identity full;

alter table public.ai_threads enable row level security;
create policy "signed in full access ai_threads" on public.ai_threads
  for all to authenticated using (true) with check (true);
alter table public.ai_threads replica identity full;

alter table public.ai_messages enable row level security;
create policy "signed in full access ai_messages" on public.ai_messages
  for all to authenticated using (true) with check (true);
alter table public.ai_messages replica identity full;

alter table public.recurring_costs enable row level security;
create policy "signed in full access recurring_costs" on public.recurring_costs
  for all to authenticated using (true) with check (true);
alter table public.recurring_costs replica identity full;

alter table public.debts enable row level security;
create policy "signed in full access debts" on public.debts
  for all to authenticated using (true) with check (true);
alter table public.debts replica identity full;

alter table public.debt_balances enable row level security;
create policy "signed in full access debt_balances" on public.debt_balances
  for all to authenticated using (true) with check (true);
alter table public.debt_balances replica identity full;

-- app_secrets: row level security with no policy at all.
alter table public.app_secrets enable row level security;

alter publication supabase_realtime add table
  public.people, public.goals, public.categories, public.expenses, public.incomes,
  public.budgets, public.savings_accounts, public.savings_loans,
  public.savings_movements, public.goal_allocations,
  public.advice, public.ai_threads, public.ai_messages,
  public.recurring_costs, public.debts, public.debt_balances;


/* ======================================================================
   One account
   ====================================================================== */

-- The first account is made on the welcome screen (/api/setup); after that
-- the database refuses any other, however it's asked: a sign-up with the
-- public key, the dashboard, the admin API. A new Supabase project allows
-- sign-ups and every signed-in user sees the whole budget, so without this
-- anyone with the site's URL could make an account and read it. To allow a
-- second account after all:
--   drop trigger one_household_account on auth.users;
create function public.one_household_account()
returns trigger
language plpgsql security definer
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

create trigger one_household_account
  before insert on auth.users
  for each row execute function public.one_household_account();


/* ======================================================================
   Something to start with
   ====================================================================== */

-- Eight categories with limits (change them in Settings) and a goal, which
-- also becomes a trip category through the trigger above. People are left
-- out on purpose: the app asks for them on the first launch.
insert into public.categories (name, color, monthly_limit, sort_order) values
  ('Groceries',    '#22c55e', 1600, 1),
  ('Eating out',   '#f97316',  500, 2),
  ('Transport',    '#38bdf8',  600, 3),
  ('Bills & home', '#6366f1', 2500, 4),
  ('Clothes',      '#ec4899',  500, 5),
  ('Fun',          '#a855f7',  400, 6),
  ('Health',       '#14b8a6',  300, 7),
  ('Other',        '#94a3b8',  300, 8);

insert into public.goals (name, target_amount) values ('Holiday', 10000);
