-- Savings accounts, what happens on them, and goals funded from them.
--
-- An account is WHERE money is (a bank savings account, a deposit, cash); its
-- balance is the sum of its movements. A goal is WHAT money is for (a trip,
-- an emergency fund). An allocation assigns part of an account's balance to
-- a goal; whatever isn't assigned is "unassigned". A goal can draw on several
-- accounts, an account can fund several goals.
--
-- Money moves through the functions at the bottom, which lock the account
-- first: two phones saving at once can't push allocations past the balance.
--
-- Also: categories that are projects (a trip) rather than monthly.
--
-- Same access model as the rest: signed-in users only, live via Realtime.
-- Safe to deploy the app before running this; the Savings tab then explains
-- what to run, and everything else keeps working.

/* ---------- accounts ---------- */
create table if not exists public.savings_accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null check (length(name) between 1 and 60),
  kind          text        not null default 'savings'
                check (kind in ('savings', 'deposit', 'investment', 'retirement', 'cash', 'other')),
  -- keys match PERSON_LABELS in src/config.ts, or both of you
  owner         text        not null default 'joint' check (owner in ('bubs', 'meow', 'joint')),
  -- yearly, in percent; null when it doesn't earn interest
  interest_rate numeric(5, 2) check (interest_rate is null or interest_rate between 0 and 100),
  color         text        not null default '#3987e5',
  sort_order    integer     not null default 0,
  archived      boolean     not null default false,
  note          text,
  created_at    timestamptz not null default now()
);

/* ---------- movements ---------- */
-- Signed: money in is positive, money out negative. A transfer between two
-- accounts is a pair of 'transfer' rows sharing a transfer_id.
create table if not exists public.savings_movements (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid        not null references public.savings_accounts (id) on delete cascade,
  kind          text        not null
                check (kind in ('deposit', 'withdrawal', 'interest', 'adjustment', 'transfer')),
  amount        numeric(12, 2) not null check (amount <> 0),
  movement_date date        not null default current_date,
  person        text        check (person in ('bubs', 'meow')),
  note          text,
  -- the goal it was saved for or taken from, if any
  goal_id       uuid        references public.goals (id) on delete set null,
  transfer_id   uuid,
  created_at    timestamptz not null default now(),
  check (
    (kind = 'deposit' and amount > 0)
    or (kind = 'withdrawal' and amount < 0)
    or kind in ('interest', 'adjustment', 'transfer')
  )
);

create index if not exists savings_movements_account_idx
  on public.savings_movements (account_id, movement_date desc);

/* ---------- goals, grown up ---------- */
-- target_amount 0 means open-ended (an emergency fund that just grows).
-- current_amount stays for older app versions; progress now comes from
-- allocations.
alter table public.goals add column if not exists target_date date;
alter table public.goals add column if not exists color text not null default '#3987e5';
alter table public.goals add column if not exists sort_order integer not null default 0;
alter table public.goals add column if not exists archived boolean not null default false;
alter table public.goals add column if not exists note text;

/* ---------- trips and projects ---------- */
-- A category can be a project (a trip, a renovation) instead of a monthly
-- one: it doesn't start over each month, it has a budget for the whole of it,
-- and its spending stays out of the monthly limits, because it's paid for
-- from savings, from the goal it can be tied to.
alter table public.categories add column if not exists kind text not null default 'monthly';
alter table public.categories add column if not exists budget_total numeric(12, 2);
alter table public.categories add column if not exists starts_on date;
alter table public.categories add column if not exists ends_on date;
alter table public.categories add column if not exists goal_id uuid
  references public.goals (id) on delete set null;

do $$
begin
  alter table public.categories add constraint categories_kind_check
    check (kind in ('monthly', 'project'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.categories add constraint categories_budget_total_check
    check (budget_total is null or budget_total >= 0);
exception when duplicate_object then null;
end $$;

/* ---------- allocations ---------- */
create table if not exists public.goal_allocations (
  account_id uuid        not null references public.savings_accounts (id) on delete cascade,
  goal_id    uuid        not null references public.goals (id) on delete cascade,
  amount     numeric(12, 2) not null check (amount > 0),
  updated_at timestamptz not null default now(),
  primary key (account_id, goal_id)
);

/* ---------- access ---------- */
alter table public.savings_accounts  enable row level security;
alter table public.savings_movements enable row level security;
alter table public.goal_allocations  enable row level security;

drop policy if exists "signed in full access savings_accounts" on public.savings_accounts;
create policy "signed in full access savings_accounts" on public.savings_accounts
  for all to authenticated using (true) with check (true);

drop policy if exists "signed in full access savings_movements" on public.savings_movements;
create policy "signed in full access savings_movements" on public.savings_movements
  for all to authenticated using (true) with check (true);

drop policy if exists "signed in full access goal_allocations" on public.goal_allocations;
create policy "signed in full access goal_allocations" on public.goal_allocations
  for all to authenticated using (true) with check (true);

/* ---------- realtime ---------- */
alter table public.savings_accounts  replica identity full;
alter table public.savings_movements replica identity full;
alter table public.goal_allocations  replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.savings_accounts';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.savings_movements';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.goal_allocations';
exception when duplicate_object then null;
end $$;

/* ---------- arithmetic ---------- */
create or replace function public.savings_balance(acc uuid)
returns numeric
language sql stable security invoker
as $$
  select coalesce(sum(amount), 0) from public.savings_movements where account_id = acc;
$$;

create or replace function public.savings_allocated(acc uuid)
returns numeric
language sql stable security invoker
as $$
  select coalesce(sum(amount), 0) from public.goal_allocations where account_id = acc;
$$;

-- Adds `delta` to a goal's share of an account (removing the row at zero).
-- Callers lock the account and check the limits first.
create or replace function public._shift_allocation(acc uuid, goal uuid, delta numeric)
returns void
language plpgsql security invoker
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

create or replace function public._lock_account(acc uuid)
returns void
language plpgsql security invoker
as $$
begin
  perform 1 from public.savings_accounts where id = acc for update;
  if not found then
    raise exception 'No such account';
  end if;
end $$;

/* ---------- moving money ---------- */

-- Money in: a deposit, or interest. With a goal, it's set aside for it.
create or replace function public.save_to(
  p_account uuid,
  p_amount  numeric,
  p_goal    uuid default null,
  p_kind    text default 'deposit',
  p_date    date default current_date,
  p_person  text default null,
  p_note    text default null
)
returns uuid
language plpgsql security invoker
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

-- Money out: from a goal's share, or from what's unassigned.
create or replace function public.take_from(
  p_account uuid,
  p_amount  numeric,
  p_goal    uuid default null,
  p_date    date default current_date,
  p_person  text default null,
  p_note    text default null
)
returns uuid
language plpgsql security invoker
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

-- The bank says the balance is p_balance: book the difference as an adjustment.
-- Going below what goals hold needs their shares lowered first (allocate).
create or replace function public.set_balance(
  p_account uuid,
  p_balance numeric,
  p_date    date default current_date,
  p_person  text default null,
  p_note    text default null
)
returns uuid
language plpgsql security invoker
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

-- Assign unassigned money to a goal (positive delta) or give it back (negative).
create or replace function public.allocate(p_account uuid, p_goal uuid, p_delta numeric)
returns void
language plpgsql security invoker
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

-- Between two accounts; a goal's share moves along with its money.
create or replace function public.transfer(
  p_from   uuid,
  p_to     uuid,
  p_amount numeric,
  p_goal   uuid default null,
  p_date   date default current_date,
  p_person text default null,
  p_note   text default null
)
returns uuid
language plpgsql security invoker
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

-- Deletes a movement (both halves of a transfer). A deleted transfer takes its
-- goal's share back to where it came from. If what's left has goals holding
-- more than an account has, their shares shrink to fit: the movement's own
-- goal first, then the biggest shares.
create or replace function public.delete_movement(p_id uuid)
returns void
language plpgsql security invoker
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

revoke execute on function public.savings_balance(uuid) from public, anon;
revoke execute on function public.savings_allocated(uuid) from public, anon;
revoke execute on function public._shift_allocation(uuid, uuid, numeric) from public, anon;
revoke execute on function public._lock_account(uuid) from public, anon;
revoke execute on function public.save_to(uuid, numeric, uuid, text, date, text, text) from public, anon;
revoke execute on function public.take_from(uuid, numeric, uuid, date, text, text) from public, anon;
revoke execute on function public.set_balance(uuid, numeric, date, text, text) from public, anon;
revoke execute on function public.allocate(uuid, uuid, numeric) from public, anon;
revoke execute on function public.transfer(uuid, uuid, numeric, uuid, date, text, text) from public, anon;
revoke execute on function public.delete_movement(uuid) from public, anon;

grant execute on function public.savings_balance(uuid) to authenticated;
grant execute on function public.savings_allocated(uuid) to authenticated;
grant execute on function public._shift_allocation(uuid, uuid, numeric) to authenticated;
grant execute on function public._lock_account(uuid) to authenticated;
grant execute on function public.save_to(uuid, numeric, uuid, text, date, text, text) to authenticated;
grant execute on function public.take_from(uuid, numeric, uuid, date, text, text) to authenticated;
grant execute on function public.set_balance(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.allocate(uuid, uuid, numeric) to authenticated;
grant execute on function public.transfer(uuid, uuid, numeric, uuid, date, text, text) to authenticated;
grant execute on function public.delete_movement(uuid) to authenticated;

/* ---------- the goal you already had ---------- */
-- Whatever was saved toward it moves onto an account called "Savings" as an
-- opening balance, set aside for that goal. Runs once: only while there are
-- no accounts yet.
do $$
declare
  g record;
  acc uuid;
begin
  if exists (select 1 from public.savings_accounts) then
    return;
  end if;
  for g in select id, current_amount from public.goals where current_amount > 0 order by created_at loop
    if acc is null then
      insert into public.savings_accounts (name, kind, owner)
      values ('Savings', 'savings', 'joint')
      returning id into acc;
    end if;
    insert into public.savings_movements (account_id, kind, amount, note, goal_id)
    values (acc, 'adjustment', g.current_amount, 'Opening balance', g.id);
    insert into public.goal_allocations (account_id, goal_id, amount)
    values (acc, g.id, g.current_amount);
  end loop;
end $$;
