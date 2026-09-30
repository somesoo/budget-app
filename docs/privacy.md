# Data and privacy

Your data is in your own Supabase database; nobody else runs a server for
this app.

- **The password is what protects it.** Every table requires a signed-in
  user, so the public key compiled into the app is useless on its own.
- **Nobody else can get an account.** Anyone signed in sees the whole
  budget, so the database accepts one account only: the first, made on the
  welcome screen. After that it refuses every other, sign-ups included. To
  allow a second one on purpose, run
  `drop trigger one_household_account on auth.users;` in the SQL Editor.
  Turning sign-ups off in Supabase (Authentication → Providers → Email) as
  well does no harm.
- **One shared account means the database can't tell you apart.** Who paid
  is attribution, not identity: anyone signed in can edit or delete any
  expense. The same goes for allowances, which are hidden out of tact, not
  locked.
- **Keys stay on the server.** The Supabase secret key and the Gemini key are
  read only by the `/api` functions. A Gemini key saved in Settings is in a
  table the app itself can't read.
- **What goes to Google**, when the AI features are on: see [AI](ai.md).
- **Your data is yours to take**: Settings → Your data → *Download CSV*
  gives every expense and income as a spreadsheet.
