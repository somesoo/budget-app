# Budget: a plan per month

No two months cost the same (December has presents, March the car
insurance), so each month can have its own plan: expected income, what to
put aside, and a limit per category. A month without a plan falls back to the
default limits from Settings.

Everything that measures against limits (the Add tab's tiles and *Safe to
spend*, the Budget tab's bars, the Insights pace line) uses the selected
month's plan.

## The Budget tab

The month against its plan: spent of planned, what's left per day, income
and savings against what was planned, per-category bars. Its month switcher
goes up to three months ahead; a future month shows its plan, or an
invitation to make one. In the running month a card leads to planning the
next one.

## The planner

It's zero-based: income − savings − every category's limit should come to 0,
so each złoty has a job, and it tells you what's left unassigned or how far
over you are.

For each category it shows what it has actually cost: *typical* (average of
the last 3 complete months), *last* month, and the same month a year ago,
each one tap to adopt, rounded up to 10 zł. *Start from* refills everything
from last month's plan, typical spending, or the defaults. "What's different
about this month?" is a note saved with the plan.

## From the paycheck

Savings split into lines: one per open goal (with a chip for what it needs a
month to be on time, and the account it goes onto), one per IKE/IKZE account,
plus *Other savings* for the rest. The plan's savings total is their sum.

An IKE/IKZE line shows what's been paid in this calendar year against the
yearly limit and offers *max out*: the monthly payment that uses the rest of
the limit by December. Planning past the limit shows a warning. Deposits and
transfers in count toward the limit; interest doesn't, and withdrawals don't
give it back. (The limits are `RETIREMENT_LIMITS` in `src/config.ts`: add
each new year's figure when it's announced.)

On the Budget tab, *From the paycheck* lists the month's lines against what
was actually paid in. In the running month each unfinished line has a *Pay
in* button (tap, then confirm) that books the rest as a deposit onto the
right account and goal.

## Last month's leftover

Planning a month also asks where the month before's unspent money goes: any
number of goals, or nowhere (it stays on the account).

- Each goal takes a percentage or a set amount: set amounts first, in order,
  as far as the money goes, then the rest by the percentages (split evenly
  until you change them).
- Each goal says what it has to go and, with a deadline, whether the plan's
  own monthly payment is enough to make it, or how much a month it falls
  short; *use the … short* fills that in as its set amount. The plan is the
  commitment and the leftover the extra.
- *Keep on the account* leaves a cushion there first; the goals share what's
  above it.

Unspent is income − planned savings − spending. At the start of the planned
month it shows up as a line in *From the paycheck*, noted "Leftover from
<month>".

## How healthy it is

Four numbers against the usual rules of thumb, each saying what it's
measured against:

- the **savings rate**: what the month puts aside, as a share of income; 20%
  or more;
- **fixed costs**: rent and bills as a share of income; under half;
- the **emergency fund** in months of typical spending (the last three months
  averaged); three to six;
- the **age of money**: how many days pay waits before it's spent, averaged
  over the latest spending (first in, first out). 30 days or more means this
  month runs on last month's money, which is what makes a budget calm. It
  counts monthly spending and what goes into savings, from the pay logged in
  the last six months.

A goal is marked as the emergency fund in its Edit sheet. While it's short, a
new plan sends last month's leftover there, and borrowing from it warns when
it would take a large part.

## Regular costs

Subscriptions and the bills that come back every 1, 2, 3, 6 or 12 months,
on the Budget tab of the running month: what they cost a month and a year,
and when each is due next (marked when it's within two weeks).

- **The rarer bills** (car insurance, a yearly subscription, the car
  service) are what catches a budget out. The card says how much they need
  put aside a month, spread evenly. Mark a goal as the bills fund (its Edit
  sheet: *Yearly bills are paid from this*) and the card says whether it
  holds enough to pay each bill on time; in the planner that goal's line gets
  a *for bills* chip with the monthly amount. Pay the bill from that goal's
  tile on the Add tab, and it comes off the account.
- **Subscriptions** get a review every three months: for each, is it still
  worth what it costs a year? Cancelled ones are put away (cancel them with
  the provider too), and the card says what that gives back a year.
- A regular cost isn't logged by itself: when you pay it, log it as an
  expense as usual.

## AI draft

*Draft a plan with AI* sends Gemini monthly totals per category and of
income for up to 12 months, the goals and your note (no individual expenses)
and gets back a limit and a one-line reason per category, suggested savings
and a few tips. Nothing is applied until you tap a suggestion or *Use all*, and nothing
is stored until you save the plan. Your note is sent as you wrote it. See
[AI](ai.md).
