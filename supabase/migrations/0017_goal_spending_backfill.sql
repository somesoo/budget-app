-- Earlier spending from goals comes off the accounts too.
--
-- Migration 0016 takes an expense paid from a goal off the savings account it
-- was on, but only for expenses logged after it ran. This does the same for
-- the ones logged before: oldest first, each exactly as a new one would be
-- (out of the goal's shares, the biggest first, then what's unassigned on the
-- accounts the goal uses). An expense that already has its movement is
-- skipped, so running this twice changes nothing.
--
-- Don't run it for money you've already taken off by hand. If you corrected
-- an account after spending from a goal ("Set balance", or a withdrawal for
-- the same thing), that spending would come off a second time; in that case
-- delete that correction in the app first, then run this.
--
-- Needs migration 0016.

do $$
declare
  e record;
begin
  for e in
    select x.id, x.category_id, x.amount, x.expense_date, x.person, x.note
    from public.expenses x
    join public.categories c on c.id = x.category_id
    where c.goal_id is not null
      and not exists (select 1 from public.savings_movements m where m.expense_id = x.id)
    order by x.expense_date, x.created_at
  loop
    perform public._spend_expense(
      e.id, e.category_id, e.amount, e.expense_date, e.person, e.note
    );
  end loop;
end $$;
