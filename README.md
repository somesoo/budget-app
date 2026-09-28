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
8. Paste and run `supabase/migrations/0005_budget_plans.sql` — monthly budget
   plans and hideable categories. The app keeps working without it (no plans,
   nothing hidden), so it's fine to deploy first and run this after.
9. Paste and run `supabase/migrations/0006_chart_exclusion.sql` — lets a
   category be left out of the "Where it goes" donut. Also optional for the
   app to run.
10. Paste and run `supabase/migrations/0007_savings.sql`: savings accounts,
   goals funded from them, and trips/projects (categories with their own
   budget, outside the monthly limits). Your existing goal and what's saved
   toward it move onto an account called "Savings". Until it's run, the
   Savings tab explains what to do and everything else works as before.
11. Paste and run `supabase/migrations/0008_ai_chat.sql`: the saved
   conversations of the Ask tab.
12. Paste and run `supabase/migrations/0009_goals_are_trips.sql`: goals and
   trips become one thing. Every goal can be spent from (the Goals tile on the
   Add tab), outside the monthly budget; a trip without a goal gets one.
13. Paste and run `supabase/migrations/0010_plan_allocations.sql`: a plan can
   split its savings between goals and IKE/IKZE accounts and name the goal the
   month before's unspent money goes to, and IKE/IKZE become account kinds of
   their own (retirement accounts with IKE or IKZE in the name switch over).
   Until it's run, plans save without the split.
14. Check **Database → Replication** that `expenses`, `categories` and `goals`
   (and, after steps 7–12, `incomes`, `advice`, `budgets`, `savings_accounts`,
   `savings_movements`, `goal_allocations`, `ai_threads` and `ai_messages`) are in the
   `supabase_realtime` publication — the migrations add them.

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
an expense filed to last month moves no bar. Look for it under History with
that month selected (the ▦ button next to search shows it as a calendar).

A date can also be corrected afterwards by tapping the expense in History.

### Budget: a plan per month

No two months cost the same — December has presents, March the car
insurance — so each month can have its own plan: expected income, what to put
aside, and a limit per category. It lives in the `budgets` table, one row per
month. A month without a plan falls back to the default limits from Settings.

Everything that measures against limits — the Add screen's tiles and "left"
figure, the Budget tab's bars, the Insights pace line — uses the selected
month's plan (`useMonthCategories`).

The **Budget** tab shows the month against its plan: spent of planned, what's
left per day, income and savings against what was planned, per-category bars.
Its month switcher goes up to three months ahead; a future month shows its
plan, or an invitation to make one. In the running month a card leads to
planning the next one.

The **planner** is zero-based: income − savings − every category's limit
should come to 0, so each złoty has a job, and it tells you what's left
unassigned or how far over you are. For each category it shows what it has
actually cost — *typical* (average of the last 3 complete months), *last*
month, and the same month a year ago — each one tap to adopt, rounded up to
10 zł. *Start from* refills everything from last month's plan, typical
spending, or the defaults. "What's different about this month?" is a free-text
note saved with the plan.

**From the paycheck.** Once there are savings accounts, the planner's
*Savings* splits into lines: one per open goal (with a chip for what it needs
a month to be on time, and the account it goes onto) and one per IKE/IKZE
account, plus *Other savings* for the rest. The plan's savings total is their
sum. An IKE/IKZE line shows what's been paid in this calendar year against the
yearly limit (`RETIREMENT_LIMITS` in `src/config.ts` — add each new year's
figure when it's announced) and offers *max out*: the monthly payment that
uses the rest of the limit by December. Planning past the limit shows a
warning. Deposits and transfers in count toward the limit; interest doesn't,
and withdrawals don't give it back.

Planning a month also asks **where the month before's unspent money goes**:
one of the goals, or nowhere (it stays on the account). Unspent is income −
planned savings − spending. At the start of the planned month it shows up as a
line in *From the paycheck*, booked as a deposit noted "Leftover from
<month>" so it isn't mistaken for the goal's regular line.

Logging a paycheck with "+ Income" opens *From the paycheck* straight away,
so the savings leave before the money gets spent.

On the Budget tab, *From the paycheck* lists the month's lines against what
was actually paid in. In the running month each unfinished line has a *Pay in*
button — tap, then confirm — that books the rest as a deposit onto the right
account (and goal). A goal line counts deposits for that goal; an IKE line
counts deposits and transfers onto the account.

**AI draft** (`api/plan.ts`) sends Gemini monthly totals per category and of
income for up to 12 months, the goal and your note — no individual expenses —
and gets back a limit and a one-line reason per category, suggested savings and
a few tips. Nothing is applied until you tap a suggestion or *Use all*, and
nothing is stored until you save the plan. The same privacy note as for
recommendations below applies, and your note is sent verbatim.

### Categories

Settings edits each category's name, color and default limit, adds new ones,
and hides old ones. The small donut button next to each one takes it out of
the Add tab's "Where it goes" chart — meant for fixed costs like rent, which
would otherwise shrink every other slice to a sliver. They still count in every
total, limit and plan, and the chart names what it left out. Hiding (the `archived` column) rather than deleting,
because expenses reference their category: a hidden category disappears from
the Add screen, the pickers and planning, while its old expenses keep it.

### The savings goal

The goal card on **Budget** is where money goes in: *Add money* → a quick
amount or a typed one → confirm. A leading minus takes money back out, and the
balance never goes below zero. Settings is for the goal's name, its target and
correcting the saved total outright.

The addition runs in the database through the `add_to_goal` function rather
than in the browser. Reading the balance, adding to it locally and writing it
back would lose a contribution whenever both phones paid in at the same moment.

The goal holds a running total, not a list of contributions — it does not
record who paid in or when. A contributions history would be a separate table.

### Deleting a savings account

An account's *Edit* sheet can hide it or delete it. Deleting takes its
movements and what it held for goals with it (the goals lose that money), so
the sheet says exactly what goes before it asks you to confirm. To keep the
history, hide it, or move the money elsewhere first. A plan that paid into a
deleted account drops that line when it's next opened, and the amount counts
as other savings.

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
salaries repeat. Paychecks show up in History alongside expenses, where
they are edited and deleted like any other entry.

**Forecast** (top of Insights) is plain arithmetic, done in code:

- *Expected income* per person: this month's logged paychecks, or — until one
  is logged — that person's average month, marked "expected". Once a paycheck
  is logged it wins even if it's lower than usual; the forecast errs towards
  caution.
- *Projected spending*: this month's pace extended to month end.
- *Left over*, savings rate, how much a day you can still spend to break even,
  and roughly how many months to the savings goal at this month's surplus.

**Recommendations** come from Gemini, on request ("Get recommendations"),
through a Vercel function at `api/advice.ts` (the sign-in check, retries and
model fallback shared with `api/plan.ts` live in `api/_gemini.ts`):

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

### The Add tab fits one screen

The Add tab never scrolls vertically. The tiles take whatever height is left
under the donut: as many rows as fit at the minimum tile size (66 px, three
lines of text), stretched to fill the space; tiles that still don't fit go
onto further pages you swipe left and right (`CategoryPager`, CSS
scroll-snap), with dots underneath. Because tile height varies, the points at
which a tile's text flips to dark as the fill rises are computed from the
actual height (`CategoryTile`).

### Safe to spend

The line at the top of the Add tab is the month's money that's really free:
income logged this month − the plan's savings (paid in yet or not: they're
spoken for) − what's been spent, trips left out. Until a paycheck is logged
the plan's expected income stands in, marked "expected". Below zero it turns
red. Without a plan or income it falls back to spent against the limits.

### Tile fill and heatmap

- A category tile fills from the bottom: `spent / monthly limit`
  (`fillPercent`). Its big number is what's left to spend this month, with
  what's been spent underneath. Past 100% it goes below zero ("−246 zł over")
  and the whole tile turns red.
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
├── pages/        # Home, History, Budget, Insights, Settings
├── hooks/        # useDeviceUser, useSession, useExpenses, useRealtimeSync
├── lib/          # supabaseClient, calculations, insights, forecast, history, planning
├── config.ts     # names, labels, quick amounts — all the tunables
└── types/        # Expense, Category, Goal
api/
├── _gemini.ts    # shared: sign-in check, Gemini call with retry + fallback
├── advice.ts     # recommendations for the running month
└── plan.ts       # a drafted budget for a month
supabase/
├── migrations/0001_init.sql
├── migrations/0002_require_login.sql
├── migrations/0003_add_to_goal.sql
├── migrations/0004_income_and_advice.sql
├── migrations/0005_budget_plans.sql
├── migrations/0006_chart_exclusion.sql
└── seed.sql
```

## Deliberately out of scope

Separate accounts per person, bank sync, recurring income that logs itself, push notifications, offline mode
(beyond the PWA caching the app shell), CSV export, deleting categories (hide
them instead), and recurring or future-dated expenses.
