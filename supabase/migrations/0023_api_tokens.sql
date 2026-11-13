-- Keys for other apps (Settings → Other apps): a home dashboard that shows the
-- month and adds an expense without the shared password.
--
-- A key is shown once, when it's made; only its SHA-256 is kept. It carries
-- what it may do ('read': the month's summary and status; 'write': add an
-- expense) and, optionally, whose expenses it adds. Revoking keeps the row,
-- so the list still says when a key was last used.
--
-- Like app_secrets: row level security with no policy and no grants. Only
-- the server functions (secret key) read or write it, never the signed-in app.
create table public.api_tokens (
  id           uuid        not null default gen_random_uuid(),
  name         text        not null,
  token_hash   text        not null,
  scopes       text[]      not null,
  person       text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  constraint api_tokens_pkey primary key (id),
  constraint api_tokens_hash_key unique (token_hash),
  constraint api_tokens_person_fkey foreign key (person)
    references public.people (id) on delete set null,
  constraint api_tokens_name_check check (char_length(btrim(name)) between 1 and 40),
  constraint api_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint api_tokens_scopes_check check (
    cardinality(scopes) between 1 and 2 and scopes <@ array['read', 'write']::text[]
  )
);

revoke all on public.api_tokens from anon, authenticated;
alter table public.api_tokens enable row level security;
