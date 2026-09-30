# AI

Three features use Google Gemini: **recommendations** for the running month
(Insights), the **plan draft** ([Budget](budget.md#ai-draft)) and the **Ask**
tab. Everything else works without it.

## Turning it on

Get a free key at [Google AI Studio](https://aistudio.google.com/apikey) and
paste it in **Settings → AI**. The app checks it with Google, then keeps it on
the server: in the `app_secrets` table, which only the server functions can
read, so it never goes back to a phone. Saving a key there needs
`SUPABASE_SERVICE_ROLE_KEY` on the server, which the one-button install has.

Alternatively set `GEMINI_API_KEY` on Vercel: it wins over the one in
Settings, and Settings then just says a key is set on the server.

Without a key, each AI feature says where to add one.

## What gets sent

- **Recommendations**: the month's **totals only**: income per person,
  spending and limit per category with a typical month, the split between
  people, goals and accounts. No notes, no individual expenses, no email. The
  card's "What gets sent to Gemini?" link says the same.
- **Plan draft**: monthly totals per category and of income for up to 12
  months, the goals and your note, as you wrote it.
- **Ask**: a summary of the household's data and the conversation.

Allowances ([Adding](adding.md#allowances)) are left out on the phones they
aren't shown on.

## How it's called

Through Vercel functions (`api/advice.ts`, `api/plan.ts`, `api/chat.ts`; the
shared part is `api/_gemini.ts`), so the key never reaches the browser:

- The function checks the caller is signed in to your Supabase before calling
  Gemini, so the site's URL alone can't spend your quota.
- Gemini is told the numbers are already computed and not to recalculate
  them, and the answers are constrained to a JSON schema; the function also
  caps and cleans what comes back.
- Recommendations are saved in the `advice` table, so the other phones see
  the same advice without another call. "Refresh" asks again.

## When Gemini is busy

A 503 from Google means the model is overloaded. It's on their side, usually
passes within a minute, and is more frequent on the free tier. The function
retries the main model once, then tries `GEMINI_FALLBACK_MODEL`, so most of
these never reach you. If one still does, the card says so; the exact reply
from Google is in Vercel → your project → Logs. Other errors aren't retried,
because retrying won't fix them: 400/403 is the key, 404 the model name, 429
your quota.

## Free or paid tier

On Google's free API tier, submitted data may be used to improve Google's
products and may be read by human reviewers; the paid tier excludes both.
Only totals are sent, but monthly income is still personal: decide which tier
you're comfortable with.
