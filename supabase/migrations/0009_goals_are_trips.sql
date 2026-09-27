-- Goals and trips become one thing.
--
-- Every savings goal can now be spent from, the way a trip could: its
-- expenses have their own total against the goal's target and stay out of
-- the monthly budget. Underneath, the spending still goes to a category of
-- kind 'project' (expenses need a category), one per goal, linked by
-- categories.goal_id. This migration makes sure that link always exists:
--
--   * a trip without a goal gets one (or is linked to the goal of the same
--     name, if there is one), with its budget as the target;
--   * a goal without a trip category gets one;
--   * from now on, adding a goal adds its category, and renaming, recolouring,
--     closing or changing a goal's target carries over to it.
--
-- Trip dates (starts_on, ends_on) stay on the category; the app edits them
-- from the goal. Safe to run more than once.

/* ---------- trips without a goal ---------- */
do $$
declare
  p record;
  g uuid;
begin
  for p in
    select * from public.categories
    where kind = 'project' and goal_id is null
    order by sort_order
  loop
    select id into g from public.goals
    where lower(trim(name)) = lower(trim(p.name))
      and not exists (select 1 from public.categories c where c.goal_id = goals.id)
    order by created_at
    limit 1;
    if g is null then
      insert into public.goals (name, target_amount, target_date, color, archived, sort_order)
      values (
        left(p.name, 60),
        coalesce(p.budget_total, 0),
        p.starts_on,
        p.color,
        p.archived,
        coalesce((select max(sort_order) + 1 from public.goals), 0)
      )
      returning id into g;
    end if;
    update public.categories set goal_id = g where id = p.id;
  end loop;
end $$;

/* ---------- keeping goal and category together ---------- */
create or replace function public._goal_to_category()
returns trigger
language plpgsql security invoker
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

drop trigger if exists goal_to_category_insert on public.goals;
create trigger goal_to_category_insert
  after insert on public.goals
  for each row execute function public._goal_to_category();

drop trigger if exists goal_to_category_update on public.goals;
create trigger goal_to_category_update
  after update of name, color, archived, target_amount on public.goals
  for each row execute function public._goal_to_category();

/* ---------- goals without a category ---------- */
insert into public.categories (name, color, monthly_limit, kind, budget_total, goal_id, archived, sort_order)
select g.name, g.color, 0, 'project', nullif(g.target_amount, 0), g.id, g.archived,
       (select coalesce(max(sort_order), 0) from public.categories) + row_number() over (order by g.sort_order, g.created_at)
from public.goals g
where not exists (select 1 from public.categories c where c.goal_id = g.id);

/* ---------- the goal's name and target win ---------- */
-- except that an open-ended goal takes over the budget of the trip linked to it
update public.goals g
set target_amount = c.budget_total
from public.categories c
where c.goal_id = g.id and c.kind = 'project'
  and g.target_amount = 0 and coalesce(c.budget_total, 0) > 0;

update public.categories c
set name = g.name, color = g.color, archived = g.archived, budget_total = nullif(g.target_amount, 0)
from public.goals g
where c.goal_id = g.id and c.kind = 'project';
