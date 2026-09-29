# Changelog

## 1.0.0

The first release meant for other people to install.

- **One-button install.** *Deploy with Vercel* copies the app, creates a
  Supabase database through the Vercel integration and fills in every
  setting. No SQL to paste, no environment variables to copy.
- **Migrations run on deploy.** `npm run build` brings the database up to
  date (`scripts/migrate.mjs`) before the new version goes live; an install
  set up by hand is recognised and only gets what it's missing.
- **Account made in the app.** A new install opens on *Welcome*: email and
  password for the shared account, then the people's names. The database
  then refuses any other account (migration 0018), so public sign-ups can't
  let a stranger in.
- **Gemini key in Settings → AI.** Checked with Google and kept on the
  server; `GEMINI_API_KEY` still works and wins. Without a key the AI
  features say where to add one.
- **Sign-in remembers the email** per phone; `VITE_AUTH_EMAIL` is optional.

Everything before this (one to four people, English and Polish, the guided
tour, plans, savings, loans, insights, Ask) is in the README.
