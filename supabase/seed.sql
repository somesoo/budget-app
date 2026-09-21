-- Starting categories with limits (editable in Settings) plus one savings goal.
-- Safe to re-run: only missing names are inserted.

insert into public.categories (name, color, monthly_limit, sort_order)
select v.name, v.color, v.monthly_limit, v.sort_order
from (values
  ('Groceries',     '#22c55e', 1600, 1),
  ('Eating out',    '#f97316',  500, 2),
  ('Transport',     '#38bdf8',  600, 3),
  ('Bills & home',  '#6366f1', 2500, 4),
  ('Clothes',       '#ec4899',  500, 5),
  ('Fun',           '#a855f7',  400, 6),
  ('Health',        '#14b8a6',  300, 7),
  ('Other',         '#94a3b8',  300, 8)
) as v(name, color, monthly_limit, sort_order)
where not exists (select 1 from public.categories c where c.name = v.name);

insert into public.goals (name, target_amount, current_amount)
select 'Holiday', 10000, 0
where not exists (select 1 from public.goals);
