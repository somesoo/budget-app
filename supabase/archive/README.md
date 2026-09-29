# Before 1.0.0

The migrations that built the database step by step, from the first version
to 1.0.0. `../schema.sql` is the same database in one file (checked by
comparing `pg_dump --schema-only` of both, plus the Realtime publication, the
trigger on `auth.users` and the starting data), so nothing here runs on a new
install.

They're kept for an install made before 1.0.0 that doesn't have all of them
yet: `scripts/migrate.mjs` runs the missing ones when `MIGRATIONS_BASELINE`
names the last one it has. `0017_goal_spending_backfill.sql` changes account
balances for spending logged before 0016; read it first.
