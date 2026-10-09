# Insights and the forecast

## Forecast

At the top of Insights, plain arithmetic done in the app:

- *Expected income* per person: this month's logged paychecks, or, until one
  is logged, that person's average month, marked "expected". Once a paycheck
  is logged it wins even if it's lower than usual; the forecast errs towards
  caution.
- *Projected spending*: this month's pace extended to month end.
- *Left over*, the savings rate, how much a day you can still spend to break
  even, and roughly how many months to the savings goal at this month's
  surplus.

Under it, *Get recommendations* asks the AI about the month (see
[AI](ai.md)).

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
  since half a month always looks cheap.
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
