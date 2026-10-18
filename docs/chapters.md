# Chapters

Life changes the budget: moving in together, a move, a new job. What one
person spent alone in a studio says little about what two spend in a flat,
and a planner that averages the two gets both wrong. So the budget can be
split into chapters.

Settings → *Chapters* → *New chapter*: a name and the day it starts.
Everything logged before that day becomes the previous chapter. Nothing is
deleted or moved; a chapter is only a line drawn in time, and deleting one
erases the line, not the expenses.

## Two switches, per phone

Once there's a past chapter, Settings → *Chapters* has two switches. Like the
[stages](stages.md), they're this phone's choice.

- **Show past chapters** (on by default). Off: History, Insights, the
  category pages, the widgets and search start where the current chapter
  does.
- **Plan from past chapters too** (off by default). On: the planner's typical
  amounts, limit suggestions and "same month last year", and the typical
  month behind money health, savings and financial independence, learn from
  past chapters as well. Off, they learn from this chapter only.

A chapter's summary always reads the chapter whole, whatever the switches.

## A chapter's summary

Settings → *Chapters*, or the list at the bottom of Insights, opens each
chapter's summary:

- spent, money in, what was left over and the savings rate, the average month;
- month by month, with the average and the priciest month;
- money in next to money out, for the months with pay logged;
- year by year (twelve months from the chapter's first), as an average month
  so a short last year still compares;
- where it went, by category, and what changed most between the first year
  and the last;
- the ten biggest buys, and the priciest weekday.

Money in and what was left over count only the months with pay logged. A
one-off on its own (something sold) doesn't make a month with income: that
month's pay just wasn't recorded.

## Gaps

A month with nothing logged at all is a gap in the record, not a month that
cost nothing. The planner and the typical month leave such months out
instead of counting them as zero, and so does a chapter's summary.

The table is `chapters` (migration `0021_chapters.sql`).
