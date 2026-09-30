# Adding expenses (the Add tab)

Adding an expense is three taps: category → amount → Save. Every other phone
shows it straight away.

## Safe to spend

The line at the top is the month's money that's really free:

> income for this month
> − what the month puts aside (the plan's savings, paid in yet or not, or more
>   if more went in; minus anything borrowed back out)
> − what's been spent, trips left out
> − the fixed costs not paid yet

Fixed costs are the categories kept out of the spending chart (rent, bills):
until the rent is paid, its money isn't free, so each of them holds back its
limit less what it has cost so far.

Until a paycheck is logged the plan's expected income stands in, marked
"expected". Below zero it turns red. Without a plan or income it falls back
to spent against the limits.

## Tiles

- A category tile fills from the bottom: spent / the month's limit. Its big
  number is what's left to spend this month, with what's been spent
  underneath. Past 100% it goes below zero ("−246 zł over") and the whole
  tile turns red.
- The tab never scrolls. The tiles take whatever height is left under the
  donut: as many rows as fit, stretched to fill the space; tiles that still
  don't fit go onto further pages you swipe left and right, with dots
  underneath.
- The text on a tile stays readable on any colour picked in Settings.

## Backdating

The amount screen has a date row: **Today** (preselected, so the common case
stays three taps), **Yest.** and a picker for anything older. Future dates
are not offered.

Saving with an older date confirms the date in the toast, because a
backdated expense often changes nothing on screen: the tiles show the current
month. Look for it under History with that month selected (the ▦ button next
to search shows the month as a calendar). A date can be corrected afterwards
by tapping the expense in History.

## Income

"+ Income" logs a paycheck: who received it, the date, a note. The last
amount per person is offered as a one-tap chip, since salaries repeat.
Paychecks show up in History alongside expenses, where they are edited and
deleted like any other entry. Logging one opens *From the paycheck* straight
away (see [Budget](budget.md#from-the-paycheck)), so the savings leave before
the money gets spent.

- **Pay for the month after.** *Pays for* says which month it's income for;
  from the 25th it suggests the month after, since pay on the 28th usually
  pays for that. Every monthly number counts it there; History still lists
  it on the day it arrived.
- **One-off.** A returned deposit or something sold counts for its month but
  stays out of the typical pay the planner and forecast expect.

## Categories

Settings edits each category's name, colour and default limit, adds new
ones, and hides old ones.

- The small donut button takes a category out of the "Where it goes" chart:
  meant for fixed costs like rent, which would otherwise shrink every other
  slice to a sliver. It still counts in every total, limit and plan, and the
  chart names what it left out. It also makes it a fixed cost for *Safe to
  spend*.
- Hiding rather than deleting, because expenses keep their category: a hidden
  one disappears from the Add screen, the pickers and planning, while its old
  expenses keep it.

## Allowances

A category can be one person's allowance (Settings → the category → Whose):
money nobody has to explain. Only its owner's phone shows its tile, spending
and entries (Add, History, Budget, Insights, and what the AI gets). The other
phones see it only inside the month's totals until it goes over its limit.
Then it shows up first among their tiles, red, saying only that it's over
(not by how much or on what, and there's nothing to open), and in the Budget
tab's warnings. Next month, or once it's back under, it's gone again. One shared
sign-in means this is tact, not security.

## Spending from a goal

A goal (a trip, the emergency fund) has a tile of its own on the Add tab.
Spending from it stays out of the monthly budget and takes the money off the
savings account it was on. See [Savings](savings.md#spending-from-a-goal).
