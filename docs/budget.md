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

Three numbers against the usual rules of thumb, each saying what it's
measured against:

- the **savings rate**: what the month puts aside, as a share of income; 20%
  or more;
- **fixed costs**: rent and bills as a share of income; under half;
- the **emergency fund** in months of typical spending (the last three months
  averaged); three to six.

A goal is marked as the emergency fund in its Edit sheet. While it's short, a
new plan sends last month's leftover there, and borrowing from it warns when
it would take a large part.

## AI draft

*Draft a plan with AI* sends Gemini monthly totals per category and of
income for up to 12 months, the goals and your note (no individual expenses)
and gets back a limit and a one-line reason per category, suggested savings
and a few tips. Nothing is applied until you tap a suggestion or *Use all*, and nothing
is stored until you save the plan. Your note is sent as you wrote it. See
[AI](ai.md).
