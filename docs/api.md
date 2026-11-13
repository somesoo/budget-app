# For other apps

A home dashboard or a script can show this month and add an expense with a
**key**, without the shared password. Keys are made in the app: *Settings →
Other apps*.

## Keys

- **Made in Settings, shown once.** Give it a name ("Home dashboard"), tick
  what it may do, copy it. Only its SHA-256 is kept, in a table the signed-in
  app itself can't read; nobody can read a key back, only revoke it.
- **What it may do.** *Read the month*: the summary, the category status,
  the list of categories. *Add expenses*: one new expense at a time. A key
  can't edit or delete anything, and never sees notes, savings, debts,
  income entries or the AI.
- **Whose expenses.** A key that adds can be tied to one person: then it adds
  only their expenses and the other app needn't say who. Left open, the other
  app names the person with each expense.
- **Revoking** stops a key at once. Up to ten at a time.
- The server needs `SUPABASE_SERVICE_ROLE_KEY` (see [Installing](install.md)),
  the same as for saving the Gemini key.

Send the key as `Authorization: Bearer bud_…` over HTTPS. Keep it on a
server: anyone holding a key with *Add expenses* can add expenses.

## Endpoints

All answers are JSON and `cache-control: no-store`. Amounts are plain numbers
in the budget's currency, dates `YYYY-MM-DD` in the budget's timezone
(`BUDGET_TIMEZONE`, default `Europe/Warsaw`).

| | Needs | |
| --- | --- | --- |
| `GET /api/v1/summary?month=YYYY-MM` | read | the month in a few numbers |
| `GET /api/v1/month?month=YYYY-MM` | read | every category against its limit |
| `GET /api/v1/categories` | read | what an expense can be added to, and by whom |
| `POST /api/v1/expenses` | add | one new expense |

`month` defaults to the running month.

### Summary

```json
{
  "month": "2026-11", "currency": "PLN", "today": "2026-11-13",
  "days_in_month": 30, "days_left": 17, "has_plan": true,
  "income": { "received": 9200, "planned": 9000 },
  "spending": { "spent": 3120.5, "limit": 5400, "remaining": 2279.5, "projects": 800 },
  "savings_planned": 1500, "expenses": 41,
  "categories": { "over": 1, "near": 2 },
  "last_expense": { "date": "2026-11-13", "amount": 23.5, "category": "Food" },
  "links": { "app": "https://…", "budget": "https://…/budget", "history": "https://…/history" }
}
```

`spending` counts the monthly categories; `projects` is what was spent from
goals (a trip), which is paid from savings and outside the limits. `limit`
is the month's plan where there is one, else each category's default.

### Month

`categories`: `id`, `name`, `color`, `owner` (an allowance's person, else
null), `archived`, `limit`, `spent`, `remaining`, `level` (`ok`, `near` from
80% of the limit, `over`) and `link` to the category in the app. Archived
categories appear only when something was spent in them this month.

### Adding an expense

```bash
curl -X POST https://<your app>/api/v1/expenses \
  -H 'authorization: Bearer bud_…' -H 'content-type: application/json' \
  -H 'idempotency-key: 6f1c9c1e-3c0a-4d0f-9a43-2f6d3c0b7e11' \
  -d '{"amount": 23.5, "category_id": "…", "person": "anna", "note": "bread"}'
```

- `amount`: above zero, at most two decimals.
- `category_id`: an active monthly category from `/api/v1/categories`. A
  goal's (project's) spending moves money on a savings account and stays in
  the app.
- `person`: one of the people; may be left out when the key is tied to one.
  An allowance takes only its owner's expenses.
- `note` (optional, up to 200 characters), `date` (optional: today by
  default, up to 31 days back, never ahead).
- `Idempotency-Key` (optional, a UUID) becomes the expense's id. Sending the
  same request again answers `200` with the stored expense and adds nothing,
  so a retry after a timeout is safe; the same key with different content is
  `409`.

`201` with `expense` and `category` (that category's month after it). The
phones see the new expense straight away, like one added on another phone.

### Errors

`401` no or unknown key · `403` `scope_required` · `400` with a reason
(`invalid_amount`, `invalid_category`, `invalid_person`, `person_not_allowed`,
`invalid_date`, `invalid_note`, `unknown_field`, `invalid_month`, …) · `409`
`idempotency_conflict` · `503` `server_not_configured` (no secret key) ·
`502` when Supabase couldn't be reached.
