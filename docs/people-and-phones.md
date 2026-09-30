# People and phones

## One account for the household

Everyone signs in with the same account, made on the welcome screen of a new
install. The sign-in screen asks for the email the first time on a phone and
remembers it (or never, when `VITE_AUTH_EMAIL` is set). It's a normal
username + password form, so the browser's password manager offers to save
it.

After signing in, the session is kept on that device and refreshed in the
background: the password is typed once per phone. Settings has *Sign out of
this device*.

To change the password: Supabase dashboard → **Authentication → Users → … →
Reset password**. Signed-in phones stay signed in; sign out on one to make it
ask.

## Who is who

The budget is for one to four people, named in the `people` table. A new
install asks **Who's in this budget?** right after the account: type the
names, pick which of them is holding this phone, and that's the setup.
Settings → People renames, adds (up to four) and removes them; a rename shows
on every phone at once. Someone with expenses or income logged can't be
removed, only renamed, so nothing loses whose it was.

Each person has an id made from their name (`anna`, `lukasz-zak`) that the
other tables store, and a name that is only shown, so renaming touches
nothing else.

Being signed in says *this household*, not *which of us*: each phone asks
"Who's using this phone?" on first launch and keeps the answer on **that
device** (`localStorage`, key `budget-app.device-person`); with one person it
doesn't need to ask. The person switcher on the amount screen changes it for
that one expense (when someone borrows the phone); the one in Settings
changes the device for good.

With one person every switcher, the "who spent what" widget and chart, and
allowances stay out of the way; with three or four the switchers wrap onto a
row of their own.

## Languages

English and Polish, switched in **Settings → Language** (or on the sign-in
screen). Each device keeps its own choice, starting from the browser's
language. Dates, numbers and plurals follow it, and so do the AI
recommendations and plan drafts. Adding a language: see
[Development](development.md#translations).

## The tour

A new device gets a guided tour right after choosing whose phone it is: every
screen, one element at a time, with Skip, Back and Next (Escape and the arrow
keys on a laptop). **Settings → Help → Take the tour** runs it again.
