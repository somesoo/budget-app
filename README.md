# Budget

A shared budgeting app for two people. Adding an expense is three taps
(category → amount → Save). Data is shared and syncs live between phones
through Supabase Realtime.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- TanStack Query (cache) + Supabase JS (data, auth, realtime)
- vite-plugin-pwa (installs to the phone's home screen)
- Hosted on Vercel, database on Supabase

## Setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run these two files — open each one, copy its
   *contents* into the editor and press Run (pasting the filename gives you a
   syntax error):
   - `supabase/migrations/0001_init.sql` — tables, RLS, Realtime publication
   - `supabase/seed.sql` — 8 starting categories with limits + a savings goal

   On a Mac, `pbcopy < supabase/migrations/0001_init.sql` puts a file straight
   on the clipboard.
3. Create the shared account: **Authentication → Users → Add user**, with
   *Auto Confirm User* enabled. Use any email you both remember (it is not a
   secret) and a strong password (that is the secret).
4. Turn off public sign-ups: **Authentication → Providers → Email** → disable
   *Enable sign-ups*. Otherwise anyone could create their own account and read
   the budget.
5. Now paste and run `supabase/migrations/0002_require_login.sql`, which drops
   the anonymous access policies and requires a signed-in user. Run it
   **after** step 3, or the app locks itself out.
6. Check **Database → Replication** that `expenses`, `categories` and `goals`
   are in the `supabase_realtime` publication (the first migration adds them).

### 2. Local development

```bash
cp .env.example .env   # URL + anon key from Project Settings → API,
                       # plus the account email from step 3
npm install
npm run dev
```

Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` the app shows a setup
screen instead of empty pages.

### 3. Deploy to Vercel

1. **Add New → Project** and import this repository. Vercel detects Vite on its
   own: build `npm run build`, output `dist`.
2. Under **Settings → Environment Variables** add all three, for every
   environment you use (Production, Preview, Development):

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the project's anon key |
   | `VITE_AUTH_EMAIL` | the shared account's email |

3. Deploy. Every push to `main` redeploys automatically.

`vercel.json` rewrites unknown paths to `index.html`, which is what makes
client-side routes like `/history` work on a hard refresh.

**These variables are read at build time** and baked into the bundle, so
changing one in Vercel requires a redeploy to take effect.

On the phone: open the site → "Add to Home Screen". Vercel serves HTTPS, which
a PWA requires.

## Signing in

Both phones use the same account. The login screen asks only for a password —
the email comes from `VITE_AUTH_EMAIL` — and the form is a normal username +
password form, so the browser's password manager offers to save it.

After a successful sign-in the Supabase session is stored in that device's
localStorage and refreshed in the background, so you type the password once per
phone and stay signed in. Settings has a *Sign out of this device* button.

To change the password: **Authentication → Users → … → Reset password** in the
Supabase dashboard. Existing sessions keep working; sign out on a device to
force it to ask again.

## How it works

### Who is who

Being signed in says *this household*, not *which of us* — the app asks "Who's
using this phone?" on first launch and stores the answer in **that device's**
`localStorage` (key `budget-app.device-person`). It never reaches the database,
so one phone always knows it is Bubs and the other knows it is Meow. The
switcher on the amount screen changes the person for that one expense (when
someone borrows the phone); the one in Settings changes the device for good.

Both names live in [`src/config.ts`](src/config.ts) — change `PERSON_LABELS`
there and the whole UI follows. The database stores the keys `bubs` and `meow`,
which also appear in a check constraint in the first migration, so renaming the
*keys* (as opposed to the labels) means a migration.

### Live sync

`useRealtimeSync` keeps a single `postgres_changes` subscription for the whole
app. Any change to `expenses` / `categories` / `goals` invalidates the matching
TanStack Query cache, so the other person's category tile updates without a
refresh. Saving is also optimistic — the tile grows immediately, before the
server replies.

### Tile fill and heatmap

- A category tile fills from the bottom: `spent / monthly limit`
  (`fillPercent`). Past 100% the whole tile turns red.
- A calendar day's intensity is relative to the month's daily average
  (`heatIntensity`): twice the average or more is full saturation.
- Text color comes from `readableTextColor` (WCAG contrast), so any category
  color picked in Settings stays legible.

## Data and privacy

After `0002_require_login.sql`, every RLS policy requires an authenticated
user, so the anon key in the bundle is useless on its own — the password is
what protects the data. Two things are worth knowing:

- Public sign-ups must stay disabled (step 4). With them on, anyone could
  register and pass the `authenticated` check.
- One shared account means the database cannot tell the two of you apart. Who
  paid is attribution, not identity — anyone signed in can edit or delete any
  expense.

## Layout

```
src/
├── components/   # CategoryGrid, CategoryTile, AmountPad, CalendarHeatmap, Login, …
├── pages/        # Home, Calendar, Summary, History, Settings
├── hooks/        # useDeviceUser, useSession, useExpenses, useRealtimeSync
├── lib/          # supabaseClient, calculations (limits, heatmap, colors, dates)
├── config.ts     # names, labels, quick amounts — all the tunables
└── types/        # Expense, Category, Goal
supabase/
├── migrations/0001_init.sql
├── migrations/0002_require_login.sql
└── seed.sql
```

## Deliberately out of scope

Separate accounts per person, bank sync, push notifications, offline mode
(beyond the PWA caching the app shell), CSV export, income / full cash flow,
adding and deleting categories (you can edit the 8 starting ones: name, color,
limit), and picking a date other than today when adding (a date can still be
corrected by editing the expense in History).
