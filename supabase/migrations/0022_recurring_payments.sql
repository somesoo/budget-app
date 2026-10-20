-- Paying subscriptions and regular bills.
--
-- A regular cost can be marked paid, which logs it as an expense, or set to
-- log itself on each due date. Such an expense remembers the cost and the
-- due date it paid; the pair is unique, so a due date is never logged twice,
-- not even when two phones open the app at the same moment. Expenses logged
-- by hand have neither, and unique constraints let any number of those be.
alter table public.recurring_costs
  add column if not exists auto_log boolean not null default false;

alter table public.expenses
  add column if not exists recurring_id uuid,
  add column if not exists recurring_due date;

do $$
begin
  alter table public.expenses
    add constraint expenses_recurring_id_fkey foreign key (recurring_id)
      references public.recurring_costs (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.expenses
    add constraint expenses_recurring_due_key unique (recurring_id, recurring_due);
exception
  when duplicate_object or duplicate_table then null;
end $$;
