# Insights and the forecast

## Forecast

At the top of Insights, plain arithmetic done in the app:

- *Expected income* per person: this month's logged paychecks, or, until one
  is logged, that person's average month, marked "expected". Once a paycheck
  is logged it wins even if it's lower than usual; the forecast errs towards
  caution.
- *Projected spending*: where the month is heading, worked out in three
  parts so that rent paid on the 1st doesn't look like thirty rents:
  - **bills and debts** (by each category's kind of spending, see below)
    count once: what's been paid, or what they usually come to if that's
    more, so rent not yet paid this month is expected too. "Usually" is the
    middle of the last three months, so a yearly bill paid in July isn't
    expected every month after;
  - **big one-offs**, single everyday expenses of 1,000 zł or more
    (`PROJECTION_ONE_OFF_FROM` in `src/config.ts`), count as they are;
  - **everyday spending** is extended by the day, blending this month's pace
    with your usual daily amount (last three months): early in the month the
    usual weighs most, and this month's own pace takes over as the days go
    by, so one big shop on the 2nd doesn't set the month.

  The card says how the figure is made up. The same projection is used by
  the headline numbers, the pace widget, a category's page and the
  whole-budget warning. *How much a day* leaves out the bills still to come.
- The **month's balance** first, signed and large: income minus spending
  (projected to month end in the running month), red with a warning when
  it's below zero.
- *Left over*, the savings rate, how much a day you can still spend to break
  even, and roughly how many months to the savings goal at this month's
  surplus.

Under it, *Get recommendations* asks the AI about the month (see
[AI](ai.md)).

## Where the pay went

Right under the headline numbers: the month's income as one bar, split into
what it went on. Spending is grouped by each category's *kind of spending*:

- **Everyday spending**: food, transport, the household;
- **Bills**: rent, utilities, phone, subscriptions, insurance;
- **Debts**: loan and mortgage instalments, card repayments;
- **Fun**: eating out, going out, hobbies, travel;
- **Other**: gifts, health, one-offs, anything else.

Then what went into **savings** and into **investments** (IKE, IKZE, PPK,
bonds and investment accounts): deposits minus withdrawals that month, as the
month's saving is counted everywhere else. What's left is **Left**, or
**Short** when more went out than came in; then a white line marks the
income on the bar, and everything past it was paid from elsewhere. Money
taken out of savings beyond what went in counts as money that came in. Tap a
group to see its categories.

Income is what's logged for the month, one-offs included, not the expected
pay the forecast uses: this is what happened, not what's coming.

A category's kind is picked in its sheet (Settings → Categories). Until then
the app guesses: a name it recognises (Polish or English), a regular cost
booked to it or being left out of the chart means bills, and anything it
can't tell is *Other*. The card says when some are guessed. Also a widget on
the Add screen.

## Financial independence

How much would let you live off your savings: 25 times a year of your typical
spending (the "4% rule": take out 4% a year and the money is likely to
last). The card shows how far along your savings are, and roughly how many
years it is at the pace you've been saving (the average of the last six
months), assuming 4% a year growth after inflation. An estimate to steer by;
the numbers are `FIRE_MULTIPLE` and `FIRE_REAL_RETURN` in `src/config.ts`.

## Charts

Six months back from the month picked at the top:

- **Projected month end** and **vs last month**: headline numbers.
- **Pace**: cumulative spending through the month against an even spread of
  your limits. Scrub with a finger for any day's figures.
- **Month by month**: totals per month, the selected one highlighted, limits
  as a dashed line.
- **Where the money went**: the selected month as a donut by category,
  biggest first. Categories switched out of the chart in Settings (rent and
  the like) are listed under it with what they cost.
- **Top 3 categories**: the month's three biggest, each with its share and
  against its usual cost (the average of up to three months before that have
  any spending). A finished month says how much more or less than usual,
  within 10% "about as usual"; the running month only says what's usual,
  since half a month always looks cheap. Also a widget on the Add screen.
- **Change by category**: each category up or down against the month before,
  centred on zero.
- **Who spent what**: each person per month (with two or more people).
- **Everyday spending by weekday**: average per weekday.

Every chart has a *Show numbers* table under it.

## Keeping them honest

- **A running month is compared like-for-like.** On the 21st, category
  changes compare days 1–21 of both months, the month-by-month headline uses
  the projection, and the current month's segment on the trend line is
  dashed. Measuring 21 days against 31 would make almost everything look
  "down".
- **Estimates are rounded to whole złoty**: a projection to the grosz claims
  precision it doesn't have.
- **Months before your first expense are left out**, not plotted as zeros.
- **The weekday chart leaves out single expenses of 1,000 zł or more**
  (`WEEKDAY_EXCLUDE_FROM` in `src/config.ts`), otherwise rent makes whatever
  weekday it falls on look like your priciest day.
- **Categories are named on every row, never told apart by colour alone.**
  Some of the starting colours are near-identical to colourblind eyes, so no
  chart asks you to match a category by its colour.

## Calendar

History's ▦ button shows a month as a calendar. A day's colour is relative to
the month's daily average: twice the average or more is full.
