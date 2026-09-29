#!/usr/bin/env node
/*
 * Brings the database up to date. `npm run build` calls it first, so on Vercel
 * every production deploy migrates the database before the new app goes
 * live, and a migration that fails stops the deploy.
 *
 *   npm run migrate
 *
 * A new, empty database gets supabase/schema.sql: the whole database of
 * version 1.0.0 in one go. After that, and on every deploy, it runs the files
 * in supabase/migrations that haven't run yet, in order, each in a
 * transaction. What has run is recorded in app_meta.migrations (a schema the
 * app's API doesn't expose).
 *
 * A database set up before 1.0.0, with the files now in supabase/archive, is
 * taken as 1.0.0 when it has everything up to 0018. Otherwise it stops and
 * says so: set MIGRATIONS_BASELINE to the last archived migration it has
 * (e.g. 0015) and the ones after it run first. Mind 0017 before you do.
 *
 * Connects with the first of these that is set (the Supabase integration on
 * Vercel sets the first; anywhere else, paste the connection string from
 * Supabase → Connect → Session pooler into DATABASE_URL):
 *   POSTGRES_URL_NON_POOLING, DATABASE_URL, POSTGRES_URL
 * With none of them it does nothing. Preview deploys on Vercel skip it too.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const at = (path) => fileURLToPath(new URL(`../supabase/${path}`, import.meta.url))
const SCHEMA = at('schema.sql')
const MIGRATIONS = at('migrations/')
const ARCHIVE = at('archive/')
/** What app_meta.migrations calls schema.sql. */
const BASELINE = 'schema-1.0.0'
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

const sqlFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
const version = (file) => file.replace(/\.sql$/, '')

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

/** Runs one file in a transaction and records it. */
async function run(path, name) {
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(path, 'utf8'))
    await tx`insert into app_meta.migrations (version) values (${name})`
  })
}

/** A database from before 1.0.0: bring it up to 1.0.0 with the archived files. */
async function catchUp() {
  const [{ secrets, spending }] = await sql`
    select to_regclass('public.app_secrets') is not null as secrets,
           exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'savings_movements'
                     and column_name = 'expense_id') as spending`
  const baseline = env.MIGRATIONS_BASELINE?.trim()

  if (!baseline) {
    if (!(secrets && spending)) {
      throw new Error(
        'This database was set up before 1.0.0 and lacks some of supabase/archive. ' +
          'Set MIGRATIONS_BASELINE to the last archived migration it has (e.g. 0015) ' +
          'and deploy again; the ones after it run first. Read 0017 before you do.',
      )
    }
    await sql`insert into app_meta.migrations (version) values (${BASELINE})`
    console.log('migrate: set up before 1.0.0 and complete, recorded as 1.0.0')
    return
  }

  if (!/^\d{4}$/.test(baseline)) throw new Error(`MIGRATIONS_BASELINE=${baseline}: expected e.g. 0015`)
  for (const file of sqlFiles(ARCHIVE).filter((f) => f.slice(0, 4) > baseline)) {
    await run(ARCHIVE + file, version(file))
    console.log(`migrate: ran archive/${file}`)
  }
  await sql`insert into app_meta.migrations (version) values (${BASELINE})`
  console.log(`migrate: caught up from ${baseline} to 1.0.0`)
}

async function main() {
  await sql`select pg_advisory_lock(${LOCK_ID})`

  await sql`create schema if not exists app_meta`
  await sql`
    create table if not exists app_meta.migrations (
      version    text        primary key,
      applied_at timestamptz not null default now()
    )`

  const done = new Set((await sql`select version from app_meta.migrations`).map((r) => r.version))

  if (!done.has(BASELINE)) {
    const [{ existing }] = await sql`select to_regclass('public.categories') is not null as existing`
    if (existing) {
      await catchUp()
    } else {
      await run(SCHEMA, BASELINE)
      console.log('migrate: new database, created from schema.sql (1.0.0)')
    }
  }

  let ran = 0
  for (const file of sqlFiles(MIGRATIONS)) {
    if (done.has(version(file))) continue
    await run(MIGRATIONS + file, version(file))
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
