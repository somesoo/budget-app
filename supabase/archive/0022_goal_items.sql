-- A goal's shopping list, kept for a planning page outside the app (a trip's
-- prep page that signs in with the household account). The app itself
-- doesn't show these tables: what's bought there is logged as an ordinary
-- expense in the goal's category, and that's all the app sees.
--
-- Each item has a price, who it's for and where it stands: an idea, to buy,
-- bought, already had, or dropped. expense_id is the expense it was logged
-- as when bought; deleting the expense leaves the item without it.
create table if not exists public.goal_items (
  id          uuid        not null default gen_random_uuid(),
  goal_id     uuid        not null,
  name        text        not null,
  amount      numeric(10, 2) not null default 0,
  status      text        not null default 'planned',
  -- a free label to group by: Gear, Tickets, Clothes
  section     text,
  -- a person's id from people; null is shared
  person      text,
  link        text,
  note        text,
  expense_id  uuid,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  constraint goal_items_pkey primary key (id),
  constraint goal_items_goal_id_fkey foreign key (goal_id)
    references public.goals (id) on delete cascade,
  constraint goal_items_expense_id_fkey foreign key (expense_id)
    references public.expenses (id) on delete set null,
  constraint goal_items_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint goal_items_amount_check check (amount >= 0),
  constraint goal_items_status_check check (status in ('idea', 'planned', 'bought', 'have', 'skipped'))
);

create index if not exists goal_items_goal_idx on public.goal_items (goal_id, sort_order);

alter table public.goal_items enable row level security;
drop policy if exists "signed in full access goal_items" on public.goal_items;
create policy "signed in full access goal_items" on public.goal_items
  for all to authenticated using (true) with check (true);
alter table public.goal_items replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.goal_items;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Options for an item, to compare before buying: where it's sold, the link,
-- the price, a note and any number of photos. images holds paths in the
-- goal-items storage bucket (uploaded photos) or full http(s) links. The one
-- chosen sets the item's price.
create table if not exists public.goal_item_options (
  id          uuid        not null default gen_random_uuid(),
  item_id     uuid        not null,
  label       text,
  url         text,
  price       numeric(10, 2),
  note        text,
  images      text[]      not null default '{}',
  chosen      boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  constraint goal_item_options_pkey primary key (id),
  constraint goal_item_options_item_id_fkey foreign key (item_id)
    references public.goal_items (id) on delete cascade,
  constraint goal_item_options_price_check check (price is null or price >= 0),
  constraint goal_item_options_label_check check (label is null or char_length(label) <= 120)
);

create index if not exists goal_item_options_item_idx on public.goal_item_options (item_id, sort_order);

alter table public.goal_item_options enable row level security;
drop policy if exists "signed in full access goal_item_options" on public.goal_item_options;
create policy "signed in full access goal_item_options" on public.goal_item_options
  for all to authenticated using (true) with check (true);
alter table public.goal_item_options replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.goal_item_options;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- The photos: a private bucket, readable and writable by the signed-in
-- account only (shown through short-lived signed links). Outside Supabase
-- (no storage schema) this part is skipped and options keep photo links only.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'no storage schema: goal item photos can only be links';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('goal-items', 'goal-items', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  drop policy if exists "signed in read goal-items" on storage.objects;
  create policy "signed in read goal-items" on storage.objects
    for select to authenticated using (bucket_id = 'goal-items');
  drop policy if exists "signed in add goal-items" on storage.objects;
  create policy "signed in add goal-items" on storage.objects
    for insert to authenticated with check (bucket_id = 'goal-items');
  drop policy if exists "signed in remove goal-items" on storage.objects;
  create policy "signed in remove goal-items" on storage.objects
    for delete to authenticated using (bucket_id = 'goal-items');
end $$;
