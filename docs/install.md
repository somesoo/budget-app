# Installing

Two ways to get your own copy: one button that sets everything up, or the
same steps by hand. Either way it's a free [Vercel](https://vercel.com)
account (hosting) and a free [Supabase](https://supabase.com) account (the
database).

- [One button](#one-button)
- [If something's off](#if-somethings-off)
- [By hand](#by-hand)
- [Environment variables](#environment-variables)

## One button

About five minutes, no terminal:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsomesoo%2Fbudget-app&project-name=budget&repository-name=budget&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%7D%5D)

1. Click the button and sign in to Vercel with GitHub. It copies this
   repository to your GitHub account.
2. When it asks for **Supabase**, create a new database: the free plan, a
   region close to you (Frankfurt for Poland). Vercel fills in every setting
   the app needs; there is nothing to copy by hand.
3. **Deploy.** The build creates the database itself (`scripts/migrate.mjs`
   runs `supabase/schema.sql`), so the first one takes a minute or two.
4. Open the site. It starts on **Welcome**: type an email and a password for
   the account everyone in the budget will share, then the names of the
   people. That's the whole setup.
5. Optional: **Settings → AI**, paste a free key from
   [Google AI Studio](https://aistudio.google.com/apikey) to turn on the
   recommendations, the plan draft and the Ask tab. See [AI](ai.md).
6. On each phone: open the site → *Add to Home Screen*, sign in once.

New versions: see [Updating](updating.md).

## If something's off

- **"Database not configured"** on the site: Supabase isn't connected. In the
  Vercel project: **Storage → Connect** your Supabase database, then
  **Deployments → … → Redeploy**.
- **The deploy fails at `migrate:`**: its log names the file and the error.
- **Forgot the password**: the Supabase dashboard (reachable from the Vercel
  project's Storage tab) → **Authentication → Users → … → Reset password**.
  Phones that are signed in stay signed in; sign out on one to make it ask.

## By hand

The same without the button, for a Supabase and a Vercel project you set up
yourself.

### 1. The database

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste the *contents* of `supabase/schema.sql`
   and press Run. That's the whole database: tables, access rules, Realtime,
   and eight starting categories with a goal. (On a Mac,
   `pbcopy < supabase/schema.sql` puts it on the clipboard.)

   Or let the deploy do it: put the database's connection string
   (Supabase → **Connect** → *Session pooler*) in `DATABASE_URL` on Vercel,
   and every production deploy creates or updates the database itself.

### 2. Vercel

1. **Add New → Project** and import this repository. Vercel detects Vite on
   its own: build `npm run build`, output `dist`.
2. Under **Settings → Environment Variables**, add the ones from the table
   below for every environment you use (Production, Preview, Development).
3. Deploy. Every push to `main` deploys again.

### 3. The account

With `SUPABASE_SERVICE_ROLE_KEY` set, the site's welcome screen makes it.
Without it: Supabase → **Authentication → Users → Add user**, with *Auto
Confirm User* on. Either way it's the only one the database accepts (see
[Privacy](privacy.md)).

## Environment variables

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's anon (publishable) key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role (secret) key, **no `VITE_` prefix**; lets the welcome screen make the account and Settings → AI keep a Gemini key |
| `DATABASE_URL` | optional: the connection string, so each deploy creates or updates the database |
| `VITE_AUTH_EMAIL` | optional: the account's email, so no phone has to type it |
| `GEMINI_API_KEY` | optional: a key from [Google AI Studio](https://aistudio.google.com/apikey), **no `VITE_` prefix**; wins over one typed in Settings → AI |
| `GEMINI_MODEL` | optional, defaults to `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | optional, defaults to `gemini-3.5-flash`; used when the main model stays overloaded |

- **The prefix matters.** Anything starting with `VITE_` is compiled into the
  JavaScript every visitor downloads. The service role key and
  `GEMINI_API_KEY` stay on the server, where only the `/api` functions read
  them.
- **The integration's names work too.** `SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `POSTGRES_URL_NON_POOLING` and the rest are read as well, which is why the
  one-button install needs none of the above.
- **`VITE_*` are read at build time** and baked into the bundle: after
  changing one, redeploy.
- The Supabase dashboard shows a **Next.js** snippet with `NEXT_PUBLIC_*`
  names: copy the values, not the names. A new project calls its key
  **publishable** (`sb_publishable_…`): that is the anon key.
