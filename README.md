# Budget

A shared budgeting app for two people. Adding an expense is three taps
(category → amount → Save), no login. Data is shared and syncs live between
phones through Supabase Realtime.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- TanStack Query (cache) + Supabase JS (data + realtime)
- vite-plugin-pwa (installs to the phone's home screen)

## Setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run in order:
   - `supabase/migrations/0001_init.sql` — tables, RLS, Realtime publication
   - `supabase/seed.sql` — 8 starting categories with limits + a savings goal
3. Check **Database → Replication** to confirm `expenses`, `categories` and
   `goals` are part of the `supabase_realtime` publication (the migration adds
   them itself).

With the Supabase CLI instead:

```bash
supabase link --project-ref <your-ref> && supabase db push
```

### 2. Frontend

```bash
cp .env.example .env   # paste the URL + anon key from Project Settings → API
npm install
npm run dev
```

Without the environment variables the app shows a setup screen instead of empty
pages.

### 3. Deploy

Build with `npm run build`; the output is the static `dist/` directory. Set the
same two variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) wherever you
build. See [Self-hosting on Linux](#self-hosting-on-linux) below, or use
Vercel/Netlify. On the phone: open the site → "Add to Home Screen".

## Self-hosting on Linux

The app is a static bundle — any web server will do. One-time setup:

```bash
git clone <this-repo> /srv/budget && cd /srv/budget
cp .env.example .env   # fill in the Supabase URL + anon key
npm ci && npm run build
```

To update later:

```bash
cd /srv/budget && git pull && npm ci && npm run build
```

Point the web server at `/srv/budget/dist`. Because the app uses client-side
routing, unknown paths have to fall back to `index.html` — for nginx:

```nginx
server {
    listen 80;
    server_name budget.example.com;
    root /srv/budget/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Serve it over HTTPS (e.g. `certbot --nginx`) — browsers only install a PWA and
register a service worker on a secure origin.

**Note on `.env`:** the variables are read at *build* time and baked into the
bundle, so `.env` must exist on the machine that runs `npm run build`, and
rebuilding is what applies a change.

## How it works

### Who is who

On first launch the app asks "Who's using this phone?" and stores the answer in
**that device's** `localStorage` (key `budget-app.device-person`). It never
reaches the database, so one phone always knows it is Bubs and the other knows
it is Meow. The switcher appears on the amount screen (changing the person for
that one expense — say, when someone borrows the phone) and in Settings
(changing the device setting for good).

Both names live in [`src/config.ts`](src/config.ts) — change `PERSON_LABELS`
there and the whole UI follows. The database stores the keys `bubs` and `meow`,
which are also in a check constraint in the migration, so renaming the *keys*
(as opposed to the labels) means a migration.

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

V1 has no login, by design. The app talks to the database with the `anon` key
and the RLS policies allow that role to read and write everything. In practice
that means **anyone who knows the project URL and the anon key can reach the
data** (the key is visible in the frontend bundle). For a two-person household
budget that is a deliberate trade-off; the way to change it is Supabase Auth
plus RLS policies scoped to signed-in users.

## Layout

```
src/
├── components/   # CategoryGrid, CategoryTile, AmountPad, CalendarHeatmap, …
├── pages/        # Home, Calendar, Summary, History, Settings
├── hooks/        # useDeviceUser, useExpenses, useCategories, useRealtimeSync
├── lib/          # supabaseClient, calculations (limits, heatmap, colors, dates)
├── config.ts     # names, labels, quick amounts — all the tunables
└── types/        # Expense, Category, Goal
supabase/
├── migrations/0001_init.sql
└── seed.sql
```

## Deliberately out of scope for V1

Login, bank sync, push notifications, offline mode (beyond the PWA caching the
app shell), CSV export, income / full cash flow, adding and deleting categories
(V1 lets you edit the 8 starting ones: name, color, limit), and picking a date
other than today when adding (a date can still be corrected by editing the
expense in History).
