# Migrations after 1.0.0

`../schema.sql` is the whole database of 1.0.0. A change to it from now on is
a new file here, which every install runs on its next deploy
(`scripts/migrate.mjs`), in order, once:

- Name it `NNNN_what_it_does.sql`, numbered on from the last one. The
  archive ends at 0018, so the first is `0019_…`.
- Write it for a database that has data: add a column with a default rather
  than recreating a table, move data along if something changes shape.
- It runs in a transaction; if it fails, the deploy fails and nothing of it
  stays. Test it with `DATABASE_URL=… npm run migrate` against a copy first.
- Don't change `schema.sql` for it. When enough have piled up, they can be
  folded into a new schema.sql the way 1.0.0 folded 0001–0018 (see
  `../archive`).
