-- Chapters of the household's money: moving in together, a move, a new job.
-- Each starts on a day and runs until the next one starts; what was logged
-- before the first is the chapter before it. Each phone chooses whether it
-- still shows past chapters and whether the planner learns from them
-- (Settings → Chapters); nothing is deleted.
create table if not exists public.chapters (
  id         uuid        not null default gen_random_uuid(),
  name       text        not null,
  starts_on  date        not null,
  created_at timestamptz not null default now(),
  constraint chapters_pkey primary key (id),
  constraint chapters_starts_on_key unique (starts_on),
  constraint chapters_name_check check (btrim(name) <> '')
);

alter table public.chapters enable row level security;
drop policy if exists "signed in full access chapters" on public.chapters;
create policy "signed in full access chapters" on public.chapters
  for all to authenticated using (true) with check (true);
alter table public.chapters replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.chapters;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
