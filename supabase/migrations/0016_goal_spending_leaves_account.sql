-- Spending from a goal takes the money off the account it was on.
--
-- Until now an expense paid from a goal (a trip's dinner, a car repair from
-- the emergency fund) only counted against the goal: the savings account
-- still showed the money, though it had been spent from there. Now every such
-- expense has a movement of kind 'spending' on the account, linked to it by
-- expense_id, which the database keeps in step with the expense:
--
--   * the money comes out of the goal's shares, the biggest first, so the
--     account's balance and the goal's share both go down;
--   * if the goal has less than was spent, the rest comes out of what's
--     unassigned on the accounts the goal uses (or used last); what can't be
--     covered at all is left as it is, and the goal shows it as overspent;
--   * editing the expense redoes it, deleting it puts the money back.
--
-- A 'spending' movement isn't saving less: it stays out of the pace of a goal
-- and out of what a month put aside. It can't be deleted by itself; change or
-- delete the expense instead.
--
-- Expenses from before this migration are left as they are: if their money
-- is still on an account, correct its balance ("Set balance").
--
-- Needs migration 0007 (savings). Safe to run more than once.

/* ---------- the link ---------- */
alter table public.savings_movements add column if not exists expense_id uuid
  references public.expenses (id) on delete cascade;

create index if not exists savings_movements_expense_idx
  on public.savings_movements (expense_id) where expense_id is not null;

-- a new kind: drop the old checks (whatever their names) and put them back
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where contype = 'c'
      and conrelid = 'public.savings_movements'::regclass
      and pg_get_constraintdef(oid) like '%withdrawal%'
  loop
    execute format('alter table public.savings_movements drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.savings_movements add constraint savings_movements_kind_check
  check (kind in ('deposit', 'withdrawal', 'interest', 'adjustment', 'transfer', 'spending'));

alter table public.savings_movements add constraint savings_movements_sign_check
  check (
    (kind = 'deposit' and amount > 0)
    or (kind in ('withdrawal', 'spending') and amount < 0)
    or kind in ('interest', 'adjustment', 'transfer')
  );

alter table public.savings_movements add constraint savings_movements_spending_check
  check ((kind = 'spending') = (expense_id is not null));

/* ---------- taking it out, putting it back ---------- */

-- Puts an expense's money back where it came from. A movement with a goal
-- came out of that goal's share, which gets it back; one without came out of
-- what was unassigned.
create or replace function public._unspend_expense(p_expense uuid)
returns void
language plpgsql security invoker
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

-- Takes an expense's money off the accounts, if its category is a goal's.
create or replace function public._spend_expense(
  p_expense  uuid,
  p_category uuid,
  p_amount   numeric,
  p_date     date,
  p_person   text,
  p_note     text
)
returns void
language plpgsql security invoker
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

create or replace function public._expense_to_savings()
returns trigger
language plpgsql security invoker
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

-- after insert and update, so the expense is there for expense_id to point
-- at; before delete, so the money goes back before the cascade removes the
-- movements
drop trigger if exists expense_to_savings_insert on public.expenses;
create trigger expense_to_savings_insert
  after insert on public.expenses
  for each row execute function public._expense_to_savings();

drop trigger if exists expense_to_savings_update on public.expenses;
create trigger expense_to_savings_update
  after update of amount, category_id, expense_date, person, note on public.expenses
  for each row execute function public._expense_to_savings();

drop trigger if exists expense_to_savings_delete on public.expenses;
create trigger expense_to_savings_delete
  before delete on public.expenses
  for each row execute function public._expense_to_savings();

/* ---------- deleting a movement ---------- */
-- Same as in 0007, except that spending belongs to its expense.
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

revoke execute on function public._unspend_expense(uuid) from public, anon;
revoke execute on function public._spend_expense(uuid, uuid, numeric, date, text, text) from public, anon;
grant execute on function public._unspend_expense(uuid) to authenticated;
grant execute on function public._spend_expense(uuid, uuid, numeric, date, text, text) to authenticated;
