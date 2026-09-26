-- Conversations with the AI (the Ask tab), kept so both phones see the same
-- threads and a conversation can be picked up later. The data it answers
-- from isn't stored here: it's sent fresh with every question.
--
-- Same access model as the rest: signed-in users only, live via Realtime.
-- Safe to deploy the app before running this; Ask explains what to run.

create table if not exists public.ai_threads (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null check (length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid        not null references public.ai_threads (id) on delete cascade,
  role       text        not null check (role in ('user', 'assistant')),
  content    text        not null check (length(content) between 1 and 20000),
  -- who asked; null for the assistant
  person     text        check (person in ('bubs', 'meow')),
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_thread_idx on public.ai_messages (thread_id, created_at);
create index if not exists ai_threads_updated_idx on public.ai_threads (updated_at desc);

alter table public.ai_threads  enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "signed in full access ai_threads" on public.ai_threads;
create policy "signed in full access ai_threads" on public.ai_threads
  for all to authenticated using (true) with check (true);

drop policy if exists "signed in full access ai_messages" on public.ai_messages;
create policy "signed in full access ai_messages" on public.ai_messages
  for all to authenticated using (true) with check (true);

alter table public.ai_threads  replica identity full;
alter table public.ai_messages replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.ai_threads';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.ai_messages';
exception when duplicate_object then null;
end $$;
