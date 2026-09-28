-- Three small additions from a review of how the money flows.
--
-- * A paycheck can count for another month than the one it arrived in: pay
--   that lands on the 28th usually pays for the month after. Null means the
--   month of income_date, as before.
-- * One goal can be marked as the emergency fund: the Budget tab says how
--   many months of spending it covers, a new plan sends last month's leftover
--   there first while it's short, and borrowing warns before emptying it.
-- * A category can be one person's allowance: money neither of you has to
--   explain. Its tile shows only on that person's phone, and the other sees
--   the amounts but not the notes.
--
-- Safe to deploy the app before running this; it then works as before.
-- Safe to run more than once.

alter table public.incomes
  add column if not exists for_month text check (for_month ~ '^\d{4}-\d{2}$');

alter table public.goals
  add column if not exists is_emergency boolean not null default false;

alter table public.categories
  add column if not exists owner text check (owner in ('bubs', 'meow'));
