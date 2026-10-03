# Changelog

## 1.0.0

The first release meant for other people to install.

- **One-button install.** *Deploy with Vercel* copies the app, creates a
  Supabase database through the Vercel integration and fills in every
  setting. No SQL to paste, no environment variables to copy.
- **The database in one file.** `supabase/schema.sql` is the whole database
  of 1.0.0; migrations 0001–0019 that built it step by step are in
  `supabase/archive`. A new install gets the schema on its first deploy, and
  every deploy after runs new files from `supabase/migrations`
  (`scripts/migrate.mjs`) before the new version goes live. An install from
  before 1.0.0 is recognised and caught up.
- **Account made in the app.** A new install opens on *Welcome*: email and
  password for the shared account, then the people's names. The database
  then refuses any other account, so public sign-ups can't
  let a stranger in.
- **Gemini key in Settings → AI.** Checked with Google and kept on the
  server; `GEMINI_API_KEY` still works and wins. Without a key the AI
  features say where to add one.
- **Sign-in remembers the email** per phone; `VITE_AUTH_EMAIL` is optional.
- **Debts and the way out of them.** Mortgage, loans, cards and instalments
  with their balance history; when each is paid off, and a plan that puts
  extra money on the dearest (avalanche) or smallest (snowball) first.
- **Net worth**: savings minus debts, month by month.
- **Regular costs**: subscriptions and bills that come back, what they cost a
  year, what's due soon, what the rarer ones need put aside each month
  against a bills fund, and a quarterly review of subscriptions.
- **Age of money** in the health card: how long pay waits before it's spent.
- **Financial independence**: the 25× target, how far along you are, and how
  many years away at your pace.
- **PPK and treasury bonds** as kinds of savings account.
- The Ask tab knows about debts, net worth and regular costs.
- **A guide** in Settings → Help: how to use the app day to day, step by
  step, with *Show me* taking you to each spot, and a getting-started list
  that ticks itself off.

Everything before this (one to four people, English and Polish, the guided
tour, plans, savings, loans, insights, Ask) is described in [docs](docs/README.md).
