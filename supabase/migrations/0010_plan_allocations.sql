-- Paying the paycheck out: a month's plan says where its savings go.
--
-- Until now a plan had one number, "savings". Now it can split it: so much
-- toward each goal (onto the account the goal is kept on), so much onto each
-- IKE or IKZE. Whatever isn't split stays "other savings". `savings` keeps
-- holding the total, so everything that reads it carries on unchanged.
--
-- IKE and IKZE become account kinds of their own, because they have a yearly
-- contribution limit the planner keeps an eye on. Existing retirement accounts
-- with IKE or IKZE in their name are switched over.
--
-- The plan also says which goal the previous month's unspent money goes to.
--
-- Safe to deploy the app before running this: plans then save without the
-- split, and retirement accounts stay "Retirement". Safe to run more than once.

/* ---------- where the month's savings go ---------- */
-- [{ "account_id": uuid | null, "goal_id": uuid | null, "amount": number }]
-- A line with a goal is money for that goal (kept on account_id); a line
-- without one is money onto the account itself, like a monthly IKE payment.
alter table public.budgets
  add column if not exists allocations jsonb not null default '[]'::jsonb;

/* ---------- what wasn't spent ---------- */
-- The goal the month before's unspent money goes to, chosen while planning:
-- { "goal_id": uuid, "account_id": uuid | null }, or null to leave it be.
alter table public.budgets
  add column if not exists carryover jsonb;

/* ---------- IKE and IKZE ---------- */
alter table public.savings_accounts drop constraint if exists savings_accounts_kind_check;
alter table public.savings_accounts add constraint savings_accounts_kind_check
  check (kind in ('savings', 'deposit', 'investment', 'retirement', 'ike', 'ikze', 'cash', 'other'));

update public.savings_accounts set kind = 'ikze'
where kind = 'retirement' and name ~* '\mikze\M';

update public.savings_accounts set kind = 'ike'
where kind = 'retirement' and name ~* '\mike\M';
