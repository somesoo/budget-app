-- Paying into the savings goal.
--
-- Reading current_amount, adding to it in the browser and writing it back
-- loses money when both phones do it at once: the second write overwrites the
-- first. Doing the arithmetic in the database makes the increment atomic, so
-- concurrent contributions add up.

create or replace function public.add_to_goal(goal_id uuid, delta numeric)
returns public.goals
language sql
security invoker
as $$
  update public.goals
  set current_amount = greatest(current_amount + delta, 0)
  where id = goal_id
  returning *;
$$;

revoke execute on function public.add_to_goal(uuid, numeric) from anon;
grant execute on function public.add_to_goal(uuid, numeric) to authenticated;
