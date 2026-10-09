# Learning it a step at a time

The app does a lot, and all of it at once is a wall. So it opens in four
stages, each one a habit that makes sense once the one before it has taken.
Settings → *What the app shows* picks the stage and has a short lesson for
each: why the habit matters, what it adds, three things to do.

| Stage | The habit | Adds |
|---|---|---|
| 1. Track | Log what you spend and earn | Adding, History, the widgets on where it goes, Top 3 and where the pay went |
| 2. Plan | A plan for the month | Budget and Insights tabs, warnings, pace and forecast widgets |
| 3. Save | Pay yourself first | Savings tab, goals, *From the paycheck*, money health |
| 4. Everything | The whole picture | Regular costs, debts and net worth, more charts, financial independence, AI |

## The next stage

Once a stage's habit has taken, a one-line banner on the Add screen suggests
the next one and opens its lesson:

- to **Plan**: two weeks of logging and at least 20 expenses;
- to **Save**: this month has a plan and a paycheck is logged;
- to **Everything**: a savings account and two complete months logged.

*Not yet* (or ✕) puts it off for two weeks. The rules are `readyForNext` in
`src/lib/features.ts`.

## One feature at a time

*Switch features one by one* lists every feature with the stage it belongs
to. A switch wins over the stage either way: debts at stage 1, or no AI at
stage 4. *Back to what the stage shows* undoes them; moving to another stage
does too.

## What hiding does

Nothing is deleted. A hidden feature's tab, cards, widgets, tour steps and
guide steps aren't shown; its data stays, keeps counting in totals (the
month's spending, net worth) and is all there when it's switched back on.

It's a choice of this phone, kept in the browser like the other device
settings, so each person learns at their own pace. A phone that has never
saved a setting starts at stage 1; one that has keeps everything until a
stage is picked.
