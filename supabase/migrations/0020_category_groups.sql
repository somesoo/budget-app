-- What kind of spending a category is, for "Where the pay went": everyday
-- spending, bills, debts (loan instalments), fun, or other. Null: the app
-- guesses from the name, whether a regular cost is booked to it, and whether
-- it's left out of the chart, until someone picks one in the category's sheet.
alter table public.categories
  add column if not exists spending_group text;

alter table public.categories
  drop constraint if exists categories_spending_group_check;
alter table public.categories
  add constraint categories_spending_group_check
  check (spending_group is null or spending_group in ('daily', 'bills', 'debts', 'fun', 'other'));
