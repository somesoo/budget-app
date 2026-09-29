-- The people in the budget: one to four, named when the app is set up.
--
-- Until now the two of you were fixed in the code as 'bubs' and 'meow', and
-- every table checked for exactly those. Now each person is a row here: the
-- id is what the other tables store, the name is only for display, so a
-- rename touches nothing else.
--
-- An install that already has data keeps it as it is: Bubs and Meow become
-- the first two rows, under the same ids. A fresh one starts empty, and the
-- app asks who's in the budget before anything else.
--
-- Same access model as the rest: signed-in users only, live via Realtime.
-- Safe to deploy the app before running this; it then keeps Bubs and Meow.

create table if not exists public.people (
  id         text        primary key check (id ~ '^[a-z0-9-]{1,24}$'),
  name       text        not null check (char_length(btrim(name)) between 1 and 30),
  color      text        not null default '#3987e5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);

alter table public.people enable row level security;

drop policy if exists "signed in full access people" on public.people;
create policy "signed in full access people" on public.people
  for all to authenticated using (true) with check (true);

alter table public.people replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.people';
exception when duplicate_object then null;
end $$;

-- the old checks allowed only 'bubs' and 'meow': drop every one of them
do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and connamespace = 'public'::regnamespace
      and pg_get_constraintdef(oid) like '%''bubs''%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- an existing install: the two of you, as you were
do $$
begin
  if exists (select 1 from public.expenses) or exists (select 1 from public.incomes) then
    insert into public.people (id, name, color, sort_order) values
      ('bubs', 'Bubs', '#3987e5', 0),
      ('meow', 'Meow', '#d95926', 1)
    on conflict (id) do nothing;
  end if;
end $$;
