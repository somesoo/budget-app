-- How much of the month before's unspent money stays on the account, as a
-- cushion, before the rest is split between the goals (budgets.carryover).
--
-- Safe to deploy the app before running this: plans then save without it,
-- and all of the leftover goes to the goals as before. Safe to run twice.

alter table public.budgets
  add column if not exists carryover_keep numeric(12, 2) not null default 0
  check (carryover_keep >= 0);
