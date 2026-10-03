# Updating

## The app

On your copy of the repository on GitHub, **Sync fork**. Vercel deploys it,
and the deploy updates the database before the new version goes live (when
it can reach it, see below). If an update fails, the deploy stops and the
old version keeps running.

## The database

`supabase/schema.sql` is the database of version 1.0.0. A later change to
it is a file in `supabase/migrations`, and every install runs each one once,
in order:

- **With the Supabase integration or `DATABASE_URL`** (the one-button
  install has it), the deploy does it (`scripts/migrate.mjs`). Nothing to do.
- **Without either**, paste each new file from `supabase/migrations` into the
  Supabase SQL Editor, oldest first. Or run `npm run migrate` on your machine
  with `DATABASE_URL` set.

What has run is recorded in the database, in `app_meta.migrations`.

## An install from before 1.0.0

Those were built step by step from the files now in `supabase/archive`
(0001–0019). The first deploy with `DATABASE_URL` looks at what's there:

- **It has all of them**: recorded as 1.0.0, and it carries on from there.
- **It doesn't**: the deploy stops and says so. Set `MIGRATIONS_BASELINE` on
  Vercel to the last one it has (e.g. `0015`) and deploy again; the missing
  ones run first.

Read `supabase/archive/0017_goal_spending_backfill.sql` before you let it
run: it takes spending from goals logged before 0016 off the savings
accounts, which would count twice where you already corrected a balance by
hand.

Writing a migration: see [Development](development.md#changing-the-database).
