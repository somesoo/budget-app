-- Pay versus one-off money. A paycheck repeats; a returned deposit, something
-- sold or a gift doesn't. Both count as what came in that month, but only pay
-- goes into the typical income the planner suggests and the forecast expects,
-- so one good month doesn't make the next plan count on money that won't come.
--
-- Safe to deploy the app before running this; everything then counts as pay,
-- as before. Safe to run more than once.

alter table public.incomes
  add column if not exists one_off boolean not null default false;
