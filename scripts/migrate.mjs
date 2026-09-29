#!/usr/bin/env node
/*
 * Brings the database up to date: runs every file in supabase/migrations that
 * hasn't run yet, in order, each in a transaction. `npm run build` calls it
 * first, so on Vercel every deploy migrates the database before the new app
 * goes live, and a migration that fails stops the deploy.
 *
 *   npm run migrate
 *
 * Connects with the first of these that is set (the Supabase integration on
 * Vercel sets the first; anywhere else, paste the connection string from
 * Supabase → Connect → Session pooler into DATABASE_URL):
 *   POSTGRES_URL_NON_POOLING, DATABASE_URL, POSTGRES_URL
 * With none of them it does nothing, and the migrations are run by hand in the
 * SQL Editor as before. Preview deploys on Vercel skip it too.
 *
 * What has run is recorded in app_meta.migrations (a schema the app's API
 * doesn't expose). A fresh database also gets supabase/seed.sql, right after
 * 0001, like the manual setup.
 *
 * A database set up by hand before this existed has tables but no record.
 * If it has the people table (0015) it's taken as up to 0015; otherwise set
 * MIGRATIONS_BASELINE to the last migration you ran by hand, e.g. 0012, and
 * everything after it runs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const SEED = fileURLToPath(new URL('../supabase/seed.sql', import.meta.url))
// any fixed number; keeps two deploys building at once from migrating twice
const LOCK_ID = 7_310_202_601

const env = process.env
const url = env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL

if (!url) {
  console.log('migrate: no database URL set, skipping (see scripts/migrate.mjs)')
  process.exit(0)
}
// a preview deploy of a branch shares the production database: leave it be
if (env.VERCEL_ENV === 'preview' && env.MIGRATE_PREVIEWS !== '1') {
  console.log('migrate: preview deploy, skipping (set MIGRATE_PREVIEWS=1 to run anyway)')
  process.exit(0)
}

const files = readdirSync(DIR)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort()
const number = (name) => name.slice(0, 4)

/**
 * Supabase's certificate isn't in Node's trust store, and `sslmode=require`
 * in the URL would make the driver insist on verifying it: encrypt without
 * verifying instead, which is what sslmode=require means to psql.
 */
function connect(raw) {
  const parsed = new URL(raw)
  parsed.searchParams.delete('sslmode')
  parsed.searchParams.delete('supa')
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  return postgres(parsed.toString(), {
    ssl: local ? false : 'require',
    // one connection: the advisory lock belongs to the session
    max: 1,
    // the transaction pooler (POSTGRES_URL, port 6543) has no prepared statements
    prepare: false,
    onnotice: () => {},
  })
}

const sql = connect(url)

async function main() {
  await sql`select pg_advisory_lock(${LOCK_ID})`

  await sql`create schema if not exists app_meta`
  await sql`
    create table if not exists app_meta.migrations (
      version    text        primary key,
      applied_at timestamptz not null default now()
    )`

  const done = new Set((await sql`select version from app_meta.migrations`).map((r) => r.version))
  const [{ existing, people }] = await sql`
    select to_regclass('public.categories') is not null as existing,
           to_regclass('public.people') is not null as people`

  if (done.size === 0 && existing) {
    const baseline = env.MIGRATIONS_BASELINE?.trim() || (people ? '0015' : '')
    if (!/^\d{4}$/.test(baseline)) {
      throw new Error(
        'This database was set up by hand and has no record of which migrations ran. ' +
          'Set MIGRATIONS_BASELINE to the last one you ran (e.g. 0012) and deploy again.',
      )
    }
    const skipped = files.filter((f) => number(f) <= baseline).map((f) => f.replace(/\.sql$/, ''))
    for (const version of skipped) {
      await sql`insert into app_meta.migrations (version) values (${version})`
      done.add(version)
    }
    console.log(`migrate: set up by hand up to ${baseline}, recorded as done`)
  }

  const fresh = !existing
  let ran = 0
  for (const file of files) {
    const version = file.replace(/\.sql$/, '')
    if (done.has(version)) continue
    const body = readFileSync(DIR + file, 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      if (fresh && number(file) === '0001' && existsSync(SEED)) {
        await tx.unsafe(readFileSync(SEED, 'utf8'))
      }
      await tx`insert into app_meta.migrations (version) values (${version})`
    })
    console.log(`migrate: ran ${file}`)
    ran++
  }
  console.log(ran ? `migrate: ${ran} migration(s) applied` : 'migrate: database is up to date')
}

try {
  await main()
} catch (error) {
  console.error(`migrate: failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
