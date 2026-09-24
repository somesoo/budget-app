-- Leave a category out of the "Where it goes" donut.
--
-- Fixed costs like rent dwarf everything else in a part-to-whole chart, so the
-- slices you can actually influence shrink to slivers. Excluded categories
-- still count everywhere else — totals, limits, the budget.
--
-- Safe to deploy the app before running this: a missing column reads as
-- "shown in the chart".

alter table public.categories
  add column if not exists show_in_chart boolean not null default true;
