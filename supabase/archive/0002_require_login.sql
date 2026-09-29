-- Lock the data behind a login.
--
-- Until now the `anon` role could read and write everything, which meant the
-- anon key shipped in the frontend bundle was the only thing standing between
-- a stranger and the budget. From here on every policy requires a signed-in
-- user, so the password is what actually protects the data.
--
-- Before running this, create the shared account in the Supabase dashboard
-- (Authentication → Users → Add user, with "Auto Confirm User" on) — otherwise
-- the app will be locked out of its own data.

drop policy if exists "anon full access categories" on public.categories;
drop policy if exists "anon full access expenses" on public.expenses;
drop policy if exists "anon full access goals" on public.goals;

create policy "signed in full access categories" on public.categories
  for all to authenticated using (true) with check (true);

create policy "signed in full access expenses" on public.expenses
  for all to authenticated using (true) with check (true);

create policy "signed in full access goals" on public.goals
  for all to authenticated using (true) with check (true);
