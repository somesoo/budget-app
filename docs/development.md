# Development

## Stack

- React 18 + Vite + TypeScript, Tailwind CSS
- TanStack Query (cache) + Supabase JS (data, auth, Realtime)
- vite-plugin-pwa (installs to the phone's home screen; Vercel's HTTPS is
  what a PWA needs)
- Vercel for hosting and the `/api` functions, Supabase for the database

## Running it locally

```bash
cp .env.example .env   # URL + anon key from Supabase → Project Settings → API
npm install
npm run dev
```

Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` the app shows a setup
screen instead of empty pages. Vite reads `.env` at startup: restart
`npm run dev` after editing it.

`npm run dev` doesn't run the `/api` functions: the AI features say so
instead of failing, the sign-in screen skips the welcome check, and Settings
leaves out the AI card. To have them, use the Vercel CLI, `vercel dev`, with
`GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in `.env` (git-ignored).

| Command | |
| --- | --- |
| `npm run dev` | the app, with hot reload |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run build` | typecheck, migrate (when a database URL is set), build |
| `npm run migrate` | bring the database at `DATABASE_URL` up to date |
| `npm run i18n` | bring the translations in step with English |

## Layout

```
src/
├── components/   # screens' parts: tiles, pads, sheets, charts/, savings/, tour/, …
├── pages/        # Home (Add), History, Budget, Savings, Insights, Ask, Settings
├── hooks/        # data: useExpenses, useSavings, useBudgets, useRealtimeSync, …
├── lib/          # the arithmetic, tested: calculations, planning, savings, forecast, …
├── i18n/         # t(), <Trans>, the language setting, dates and numbers
├── locales/      # the text of the app: en/ (source) and pl/
├── config.ts     # quick amounts, currency, IKE/IKZE limits: the tunables
└── types/
api/              # Vercel functions
├── _supabase.ts  # shared: env names, sign-in check, admin calls, app_secrets
├── _gemini.ts    # shared: the Gemini key, calls with retry and fallback
├── setup.ts      # the welcome screen: makes the one account
├── gemini-key.ts # Settings → AI
├── advice.ts     # recommendations for the running month
├── plan.ts       # a drafted plan
└── chat.ts       # the Ask tab
supabase/
├── schema.sql    # the database of 1.0.0
├── migrations/   # changes since, run on deploy
└── archive/      # how 1.0.0 was built, 0001–0018
scripts/
├── migrate.mjs   # runs schema.sql / migrations, on every production build
└── i18n.mjs
```

## Changing the database

Never edit `supabase/schema.sql` for a change: it's what 1.0.0 was. Add a
file to `supabase/migrations` instead; [its README](../supabase/migrations/README.md)
says how. Every install runs it on its next deploy.

`scripts/migrate.mjs` runs during `npm run build`, only when a database URL
is set (`POSTGRES_URL_NON_POOLING`, `DATABASE_URL` or `POSTGRES_URL`), and
not on Vercel preview deploys, which share the production database (set
`MIGRATE_PREVIEWS=1` to change that). Each file runs in a transaction under an
advisory lock; a failure stops the build.

A migration runs before the new version goes live, so for a moment the old
version runs against the new database: don't drop or rename in the same
release anything the old version still uses.

## Live sync

`useRealtimeSync` keeps one Realtime subscription for the whole app. A change
to any table invalidates the matching TanStack Query cache, so the other
phones update without a refresh. Saving is optimistic: the tile grows before
the server replies.

Money moves on savings accounts go through database functions
(`save_to`, `take_from`, `transfer`, …) that lock the account first, so two
phones at once can't push goal shares past the balance.

## Translations

Every text is in `src/locales/<language>/*.json`, with a note on where it
appears. English is the source. See
[src/locales/README.md](../src/locales/README.md) for translating or adding a
language; `npm run i18n` keeps the other languages in step with English.

## The tour

The steps live in `src/lib/tour.ts`; each points at an element by a
`data-tour` attribute, and one whose element isn't on screen shows as a card
in the middle.

## Details worth knowing

- **Dropdowns** (`Select` in `src/components/savings/fields.tsx`) are drawn
  by the app rather than the browser, whose own list ignores the dark theme on
  some systems. It opens below the field, or above when there's no room, and
  works with the arrow keys, Enter and Escape.
- **Charts** are hand-drawn SVG, no charting library, so the bundle stays
  small.
- **Tile text colour** comes from `readableTextColor` (WCAG contrast); where
  it flips as the fill rises is computed from the tile's actual height.
- **`vercel.json`** rewrites unknown paths to `index.html`, so client-side
  routes like `/history` work on a hard refresh.

## Deliberately out of scope

Separate accounts per person, bank sync, recurring income that logs itself,
push notifications, offline mode (beyond the PWA caching the app), deleting
categories (hide them instead), and recurring or future-dated expenses.
