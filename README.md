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
6. Paste and run `supabase/migrations/0003_add_to_goal.sql`, which adds the
   function that pays into the savings goal.
7. Paste and run `supabase/migrations/0004_income_and_advice.sql` — the income
   table and the stored recommendations.
8. Check **Database → Replication** that `expenses`, `categories` and `goals`
   (and, after step 7, `incomes` and `advice`) are in the `supabase_realtime`
   publication — the migrations add them.

### 2. Local development

```bash
cp .env.example .env   # URL + anon key from Project Settings → API,
                       # plus the account email from step 3
npm install
npm run dev
```

Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` the app shows a setup
screen instead of empty pages.

Two things the Supabase dashboard will try to talk you into:

- It shows a **Next.js** snippet by default, with `NEXT_PUBLIC_*` names. This
  is a Vite app and only reads `VITE_*` — copy the values, not the names.
- A new project labels its key **publishable** (`sb_publishable_…`). That is
  the anon key's replacement and belongs in `VITE_SUPABASE_ANON_KEY`.

Vite reads `.env` at startup, so restart `npm run dev` after editing it.

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
   | `GEMINI_API_KEY` | your key from [Google AI Studio](https://aistudio.google.com/apikey) — **no `VITE_` prefix** |
   | `GEMINI_MODEL` | optional, defaults to `gemini-3.5-flash-lite` |
   | `GEMINI_FALLBACK_MODEL` | optional, defaults to `gemini-3.5-flash`; used when the main model stays overloaded |

   The prefix matters: anything starting with `VITE_` is compiled into the
   JavaScript every visitor downloads. `GEMINI_API_KEY` stays on the server,
   where only `/api/advice` can read it.

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

### Backdating an expense

The amount screen has a date row: **Today** (preselected, so the common case
stays three taps), **Yest.** and a picker for anything older. Future dates are
not offered — they would land outside the month you are looking at.

Saving with an older date confirms the date in the toast, because a backdated
expense often changes nothing on screen: the tiles show the current month, so
an expense filed to last month moves no bar. Look for it under History or
Calendar with that month selected.

A date can also be corrected afterwards by tapping the expense in History.

### The savings goal

The goal card on **Summary** is where money goes in: *Add money* → a quick
amount or a typed one → confirm. A leading minus takes money back out, and the
balance never goes below zero. Settings is for the goal's name, its target and
correcting the saved total outright.

The addition runs in the database through the `add_to_goal` function rather
than in the browser. Reading the balance, adding to it locally and writing it
back would lose a contribution whenever both phones paid in at the same moment.

The goal holds a running total, not a list of contributions — it does not
record who paid in or when. A contributions history would be a separate table.

### Insights

A tab of charts over the last six months, all scoped by the month switcher at
the top:

- **Projected month end** and **vs last month** — headline numbers.
- **Pace** — cumulative spending through the month against an even spread of
  your limits. Scrub with a finger for any day's figures.
- **Month by month** — totals per month, the selected one highlighted, limits
  as a dashed line.
- **Change by category** — each category up or down against the previous
  month, centred on zero.
- **Who spent what** — Bubs and Meow per month.
- **Everyday spending by weekday** — average per weekday.

Every chart has a *Show numbers* table under it.

A few rules keep the charts honest rather than just pretty:

- **A running month is compared like-for-like.** On the 21st, category changes
  compare days 1–21 of both months, the month-by-month headline uses the
  projection, and the current month's segment on the trend line is dashed.
  Measuring 21 days against 31 would make almost everything look "down".
- **Estimates are rounded to whole złoty** — a projection to the grosz claims
  precision it doesn't have.
- **Months before your first expense are left out**, not plotted as zeros.
- **The weekday chart leaves out single expenses of 1,000 zł or more**
  (`WEEKDAY_EXCLUDE_FROM` in `src/config.ts`), otherwise rent makes whatever
  weekday it falls on look like your priciest day.
- **Categories are named on every row, never identified by color alone.** The
  seeded category colors fail colorblind separation (Health vs Other is
  near-identical under deuteranopia), so no chart asks you to match a category
  by its color. The series colors the charts do use were checked with a
  palette validator against the card background.

Charts are hand-drawn SVG — no charting library, so the bundle stays small.

### Income, forecast and recommendations

**Income.** "+ Income" on the Add tab logs a paycheck — who received it, the
date, a note. The last amount per person is offered as a one-tap chip, since
salaries repeat. Paychecks are listed, edited and deleted under History →
Income.

**Forecast** (top of Insights) is plain arithmetic, done in code:

- *Expected income* per person: this month's logged paychecks, or — until one
  is logged — that person's average month, marked "expected". Once a paycheck
  is logged it wins even if it's lower than usual; the forecast errs towards
  caution.
- *Projected spending*: this month's pace extended to month end.
- *Left over*, savings rate, how much a day you can still spend to break even,
  and roughly how many months to the savings goal at this month's surplus.

**Recommendations** come from Gemini, on request ("Get recommendations"),
through a Vercel function at `api/advice.ts`:

- The browser sends the month's **totals only** — income per person, spending
  and limit per category with a typical month, the Bubs/Meow split, the goal.
  No notes, no individual expenses, no email. The card's "What gets sent to
  Gemini?" link says the same.
- The function checks the caller is signed in to your Supabase before calling
  Gemini, so the URL alone can't spend your quota.
- Gemini is told the numbers are already computed and not to recalculate them,
  and the answer is constrained to a JSON schema; the function also caps and
  sanitises what comes back.
- The result is saved in the `advice` table, so the other phone sees the same
  advice without another call. "Refresh" asks again.

**When Gemini is busy.** A 503 from Google means the model is overloaded — it's
on their side and usually passes within a minute, and it's more frequent on
the free tier. The function retries the main model once, then tries
`GEMINI_FALLBACK_MODEL`, so most of these never reach you. If one still does,
the card says so; the exact reply from Google is in Vercel → your project →
Logs. Other codes are not retried, because retrying won't fix them: 400/403
is the key, 404 the model name, 429 your quota.

**Free vs paid Gemini tier:** on Google's free API tier, submitted data may be
used to improve Google's products and may be read by human reviewers; the paid
tier excludes both. Only aggregates are sent, but monthly income is still
personal — decide which tier you're comfortable with.

**Locally**, `npm run dev` doesn't run `/api` functions; the card says so
instead of failing. To try recommendations locally, use the Vercel CLI:
`vercel dev` (with `GEMINI_API_KEY` in `.env`, which is git-ignored).

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
│   └── charts/   # PaceChart, ColumnChart, CategoryDeltaBars, PersonLines
├── pages/        # Home, Calendar, Summary, History, Insights, Settings
├── hooks/        # useDeviceUser, useSession, useExpenses, useRealtimeSync
├── lib/          # supabaseClient, calculations, insights, forecast
├── config.ts     # names, labels, quick amounts — all the tunables
└── types/        # Expense, Category, Goal
api/
└── advice.ts     # Vercel function: auth check → Gemini → recommendations
supabase/
├── migrations/0001_init.sql
├── migrations/0002_require_login.sql
├── migrations/0003_add_to_goal.sql
├── migrations/0004_income_and_advice.sql
└── seed.sql
```

## Deliberately out of scope

Separate accounts per person, bank sync, recurring income that logs itself, push notifications, offline mode
(beyond the PWA caching the app shell), CSV export, income in the Calendar view,
adding and deleting categories (you can edit the 8 starting ones: name, color,
limit), and recurring or future-dated expenses.
