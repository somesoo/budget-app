import { CaretDown, CaretUp, Check, Warning } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { AdviceCard } from '../components/AdviceCard'
import { AskLink } from '../components/AskLink'
import { useBudgetAlerts } from '../hooks/useBudgetAlerts'
import { useProjectSummaries } from '../hooks/useProjectSummaries'
import type { BudgetAlert } from '../lib/alerts'
import type { ProjectSummary } from '../lib/projects'
import { ForecastCard } from '../components/ForecastCard'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { CategoryDeltaBars } from '../components/charts/CategoryDeltaBars'
import { ChartCard, LegendItem, TooltipRow } from '../components/charts/ChartCard'
import { ColumnChart } from '../components/charts/ColumnChart'
import { PaceChart } from '../components/charts/PaceChart'
import { PersonLines } from '../components/charts/PersonLines'
import { CHART } from '../components/charts/theme'
import {
  CURRENCY_SUFFIX,
  INSIGHTS_MONTHS,
  WEEKDAY_EXCLUDE_FROM,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
} from '../config'
import { useMonthCategories } from '../hooks/useBudgets'
import { useMonthlyExpensesBetween } from '../hooks/useExpenses'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { usePrimaryGoal, useSavingsOverview, type SavingsOverview } from '../hooks/useSavings'
import { useIncomesBetween } from '../hooks/useIncomes'
import { ownCategories, ownExpenses } from '../lib/allowance'
import { buildAdviceRequest, monthForecast } from '../lib/forecast'
import {
  currentMonthKey,
  daysInMonth,
  formatAmount,
  formatMoney,
  formatMoneyWhole,
  formatMonthName,
  formatMonthShort,
  monthKeyOfDate,
  shiftMonth,
  sumExpenses,
  type MonthKey,
} from '../lib/calculations'
import {
  categoryDeltas,
  elapsedDays,
  monthlyTotals,
  monthsEndingAt,
  pacePoints,
  personByMonth,
  projectMonthEnd,
  trimLeadingEmpty,
  weekdayAverages,
  windowRange,
} from '../lib/insights'
import { type Expense, type Goal, type Income, type Person } from '../types'
import { personColor, personIds, personLabel } from '../lib/people'

export function Insights() {
  const [month, setMonth] = useState<MonthKey>(currentMonthKey())
  const months = monthsEndingAt(month, INSIGHTS_MONTHS)
  const { from, to } = windowRange(months)

  // the selected month's limits: its own plan where it has one
  const { data: categories = [] } = useMonthCategories(month)
  const {
    data: expenses,
    isLoading,
    isPlaceholderData,
    error,
  } = useMonthlyExpensesBetween(from, to)
  const { data: incomes = [] } = useIncomesBetween(from, to)
  const { data: goal } = usePrimaryGoal()
  const savings = useSavingsOverview()
  const { open: projects } = useProjectSummaries()
  const { all: alerts } = useBudgetAlerts()

  return (
    <Screen
      title="Insights"
      wide
      action={
        <div className="flex items-center gap-2">
          <AskLink question={`What stands out in ${formatMonthName(month)}'s spending?`} />
          <MonthSwitcher month={month} onChange={setMonth} />
        </div>
      }
    >
      {error ? (
        <Notice>Could not load expenses: {(error as Error).message}</Notice>
      ) : isLoading || !expenses ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-white/5" />
          ))}
        </div>
      ) : (
        // refetching another month keeps the previous render, dimmed — no flash
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-50' : ''}`}>
          <InsightsBody
            month={month}
            months={months}
            expenses={expenses}
            totalLimit={categories
              .filter((c) => !c.archived)
              .reduce((acc, c) => acc + c.monthly_limit, 0)}
            categories={categories}
            incomes={incomes}
            goal={goal}
            adviceExtras={{ alerts, savings, projects }}
          />
        </div>
      )}
    </Screen>
  )
}

interface BodyProps {
  month: MonthKey
  months: MonthKey[]
  expenses: Expense[]
  totalLimit: number
  categories: Parameters<typeof categoryDeltas>[1]
  incomes: Income[]
  goal: Goal | null | undefined
  /** Savings, trips and warnings for the recommendations. */
  adviceExtras: {
    alerts: BudgetAlert[]
    savings: SavingsOverview
    projects: ProjectSummary[]
  }
}

function InsightsBody({
  month,
  months,
  expenses,
  totalLimit,
  categories,
  incomes,
  goal,
  adviceExtras,
}: BodyProps) {
  const { person: me } = useDeviceUser()
  const activeMonths = trimLeadingEmpty(expenses, months)
  if (activeMonths.length === 0) {
    return <Notice>Nothing to chart yet. Add a few expenses and come back.</Notice>
  }

  const isCurrent = month === currentMonthKey()
  const monthName = formatMonthName(month)
  const prev = shiftMonth(month, -1)
  const prevName = formatMonthName(prev)

  const inMonth = (m: MonthKey) => expenses.filter((e) => monthKeyOfDate(e.expense_date) === m)
  const spent = sumExpenses(inMonth(month))

  // like-for-like: this month so far vs the same days of last month
  const elapsed = elapsedDays(month)
  const cutoff = isCurrent ? Math.min(elapsed, daysInMonth(prev)) : daysInMonth(prev)
  const prevSameSpan = sumExpenses(
    inMonth(prev).filter((e) => Number(e.expense_date.slice(-2)) <= cutoff),
  )
  const hasPrev = prevSameSpan > 0
  const change = hasPrev ? (spent - prevSameSpan) / prevSameSpan : null

  const projected = isCurrent ? projectMonthEnd(spent, month) : spent
  const points = pacePoints(expenses, month, totalLimit)
  const forecast = monthForecast({ month, isCurrent, expenses, incomes, goal })

  // Recommendations first, across the page. Then phone: one column, top to
  // bottom; laptop: this month on the left, comparisons on the right.
  return (
    <div className="space-y-4">
      <AdviceCard
        month={month}
        isCurrent={isCurrent}
        buildRequest={() =>
          buildAdviceRequest({
            month,
            expenses: ownExpenses(expenses, categories, me),
            categories: ownCategories(categories, me),
            goal,
            forecast,
            alerts: adviceExtras.alerts,
            savings: adviceExtras.savings,
            projects: adviceExtras.projects,
          })
        }
      />
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-4">
          <KpiRow
            spent={spent}
            projected={projected}
            isCurrent={isCurrent}
            totalLimit={totalLimit}
            change={change}
            prevName={prevName}
            sameSpan={isCurrent}
          />

          <ForecastCard forecast={forecast} isCurrent={isCurrent} goal={goal} />

          <ChartCard
            title={isCurrent ? 'Pace this month' : `Pace through ${monthName}`}
            headline={paceHeadline(spent, projected, totalLimit, isCurrent, monthName)}
            legend={
              totalLimit > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <LegendItem
                    color={CHART.accent}
                    label={isCurrent ? 'Spent so far' : 'Spent'}
                    shape="line"
                  />
                  <LegendItem
                    color={CHART.textMuted}
                    label="Even spread of limits"
                    shape="dashed"
                  />
                </div>
              )
            }
            table={{
              head: ['Day', 'Spent to date', 'Pace'],
              rows: points
                .filter((p) => p.cumulative !== null)
                .map((p) => [p.day, formatAmount(p.cumulative!), formatAmount(p.pace)]),
            }}
          >
            <PaceChart month={month} points={points} showPace={totalLimit > 0} />
          </ChartCard>

          <MonthlyCard
            month={month}
            expenses={expenses}
            activeMonths={activeMonths}
            totalLimit={totalLimit}
            projected={isCurrent ? projected : null}
          />
        </div>

        <div className="space-y-4">
          <CategoryCard
            month={month}
            expenses={ownExpenses(expenses, categories, me)}
            categories={ownCategories(categories, me)}
            hasPrevMonth={inMonth(prev).length > 0}
            dayCutoff={isCurrent ? elapsed : undefined}
          />

          {personIds().length > 1 && (
            <PeopleCard
              month={month}
              expenses={expenses}
              activeMonths={activeMonths}
              partialLast={activeMonths[activeMonths.length - 1] === currentMonthKey()}
            />
          )}

          <WeekdayCard expenses={expenses} months={months} />
        </div>
      </div>
    </div>
  )
}

/* ---------- headline numbers ---------- */

function KpiRow({
  spent,
  projected,
  isCurrent,
  totalLimit,
  change,
  prevName,
  sameSpan,
}: {
  spent: number
  projected: number | null
  isCurrent: boolean
  totalLimit: number
  change: number | null
  prevName: string
  sameSpan: boolean
}) {
  const headlineValue = isCurrent ? projected : spent
  const over = totalLimit > 0 && headlineValue !== null && headlineValue > totalLimit

  return (
    <div className="grid grid-cols-2 gap-3">
      <div
        className="rounded-2xl p-3 ring-1 ring-white/10"
        style={{ backgroundColor: CHART.surface }}
      >
        <p className="text-xs text-muted">{isCurrent ? 'Projected month end' : 'Spent'}</p>
        <p className="mt-0.5 text-xl font-bold text-white">
          {headlineValue === null
            ? 'No data'
            : isCurrent
              ? formatMoneyWhole(headlineValue)
              : formatMoney(headlineValue)}
        </p>
        {totalLimit > 0 && headlineValue !== null && (
          <p
            className="mt-0.5 text-xs font-medium"
            style={{ color: over ? CHART.warning : CHART.textMuted }}
          >
            {over ? (
              <>
                <Warning weight="fill" aria-hidden className="inline-block align-[-0.125em]" />{' '}
                {formatAmount(Math.round(headlineValue - totalLimit))} over limits
              </>
            ) : (
              <>
                <Check weight="bold" aria-hidden className="inline-block align-[-0.125em]" /> within{' '}
                {formatAmount(totalLimit)} limits
              </>
            )}
          </p>
        )}
      </div>

      <div
        className="rounded-2xl p-3 ring-1 ring-white/10"
        style={{ backgroundColor: CHART.surface }}
      >
        <p className="text-xs text-muted">
          vs {prevName}
          {sameSpan ? ', same days' : ''}
        </p>
        {change === null ? (
          <p className="mt-0.5 text-sm text-muted">No data for {prevName}</p>
        ) : (
          <>
            <p
              className="mt-0.5 text-xl font-bold"
              // spending up is bad → warm; down is good → green. Arrow + sign carry it too.
              style={{
                color: change > 0 ? CHART.more : change < 0 ? CHART.good : CHART.textPrimary,
              }}
            >
              {change > 0 ? (
                <CaretUp weight="fill" aria-hidden className="inline-block align-[-0.125em]" />
              ) : change < 0 ? (
                <CaretDown weight="fill" aria-hidden className="inline-block align-[-0.125em]" />
              ) : null}{' '}
              {change > 0 ? '+' : change < 0 ? '−' : ''}
              {Math.abs(Math.round(change * 100))}%
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {change > 0 ? 'more' : change < 0 ? 'less' : 'the same'} than last month
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function paceHeadline(
  spent: number,
  projected: number | null,
  totalLimit: number,
  isCurrent: boolean,
  monthName: string,
): ReactNode {
  if (!isCurrent) {
    if (totalLimit <= 0)
      return (
        <>
          You spent {formatMoney(spent)} in {monthName}.
        </>
      )
    const diff = spent - totalLimit
    return diff > 0 ? (
      <>
        {monthName} ended {formatMoney(diff)} over your limits.
      </>
    ) : (
      <>
        {monthName} ended {formatMoney(-diff)} under your limits.
      </>
    )
  }
  if (projected === null || totalLimit <= 0) return <>Spent {formatMoney(spent)} so far.</>
  const diff = projected - totalLimit
  return diff > 0 ? (
    <>
      At this rate you'll finish about <strong>{formatMoneyWhole(diff)} over</strong> your limits.
    </>
  ) : (
    <>
      At this rate you'll finish about <strong>{formatMoneyWhole(-diff)} under</strong> your limits.
    </>
  )
}

/* ---------- last N months ---------- */

function MonthlyCard({
  month,
  expenses,
  activeMonths,
  totalLimit,
  projected,
}: {
  month: MonthKey
  expenses: Expense[]
  activeMonths: MonthKey[]
  totalLimit: number
  /** Set while the month is running: compare where it's heading, not 21 days vs 31. */
  projected: number | null
}) {
  const totals = monthlyTotals(expenses, activeMonths)

  if (totals.length < 2) {
    return (
      <ChartCard title="Month by month">
        <p className="text-sm text-muted">
          Shows up once you have two months of expenses. A single month is just the number above.
        </p>
      </ChartCard>
    )
  }

  const selected = totals.find((t) => t.month === month)!
  const others = totals.filter((t) => t.month !== month && t.total > 0)
  const average = others.length ? others.reduce((a, t) => a + t.total, 0) / others.length : 0
  const comparable = projected ?? selected.total
  const vsAvg = average > 0 ? (comparable - average) / average : null

  return (
    <ChartCard
      title="Month by month"
      headline={
        vsAvg === null ? undefined : (
          <>
            {formatMonthName(month)} {projected !== null ? 'is on course to finish' : 'was'}{' '}
            <strong>
              {Math.abs(Math.round(vsAvg * 100))}% {vsAvg >= 0 ? 'above' : 'below'}
            </strong>{' '}
            your average month.
          </>
        )
      }
      legend={
        totalLimit > 0 && (
          <LegendItem color={CHART.textMuted} label="Monthly limits" shape="dashed" />
        )
      }
      table={{
        head: ['Month', 'Spent'],
        rows: totals.map((t) => [formatMonthName(t.month), formatAmount(t.total)]),
      }}
    >
      <ColumnChart
        ariaLabel="Total spending per month"
        emphasize={month}
        reference={totalLimit > 0 ? { value: totalLimit, label: 'limits' } : undefined}
        columns={totals.map((t) => ({
          key: t.month,
          label: formatMonthShort(t.month),
          value: t.total,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{formatMonthName(t.month)}</p>
              <TooltipRow
                label={t.month === month && projected !== null ? 'So far' : 'Spent'}
                value={formatMoney(t.total)}
              />
              {t.month === month && projected !== null && (
                <TooltipRow label="Projected" value={formatMoneyWhole(projected)} />
              )}
              {totalLimit > 0 && <TooltipRow label="Limits" value={formatMoney(totalLimit)} />}
            </>
          ),
        }))}
      />
    </ChartCard>
  )
}

/* ---------- categories vs last month ---------- */

function CategoryCard({
  month,
  expenses,
  categories,
  hasPrevMonth,
  dayCutoff,
}: {
  month: MonthKey
  expenses: Expense[]
  categories: Parameters<typeof categoryDeltas>[1]
  hasPrevMonth: boolean
  /** While the month runs: compare the same days of both months. */
  dayCutoff?: number
}) {
  const prevName = formatMonthName(shiftMonth(month, -1))
  const prevShort = formatMonthShort(shiftMonth(month, -1))
  const curShort = formatMonthShort(month)
  const span = dayCutoff !== undefined ? ` 1-${dayCutoff}` : ''
  const deltas = categoryDeltas(expenses, categories, month, dayCutoff)

  if (!hasPrevMonth) {
    return (
      <ChartCard title="Change by category">
        <p className="text-sm text-muted">
          Compares each category with the month before. Nothing logged in {prevName} yet.
        </p>
      </ChartCard>
    )
  }

  const biggestUp = deltas.find((d) => d.delta > 0)
  const biggestDown = [...deltas].sort((a, b) => a.delta - b.delta).find((d) => d.delta < 0)

  return (
    <ChartCard
      title="Change by category"
      headline={
        biggestUp ? (
          <>
            Biggest jump: <strong>{biggestUp.category.name}</strong>, +
            {formatMoney(biggestUp.delta)}{' '}
            {dayCutoff !== undefined ? `vs the same days of ${prevName}` : `vs ${prevName}`}.
          </>
        ) : biggestDown ? (
          <>
            Every category is down, most of all <strong>{biggestDown.category.name}</strong>.
          </>
        ) : undefined
      }
      legend={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem color={CHART.more} label={`More than ${prevShort}${span}`} shape="rect" />
          <LegendItem color={CHART.less} label="Less" shape="rect" />
        </div>
      }
      table={{
        head: ['Category', `${curShort}${span}`, `${prevShort}${span}`, 'Change'],
        rows: deltas.map((d) => [
          d.category.name,
          formatAmount(d.current),
          formatAmount(d.previous),
          `${d.delta > 0 ? '+' : d.delta < 0 ? '−' : ''}${formatAmount(Math.abs(d.delta))}`,
        ]),
      }}
    >
      <CategoryDeltaBars
        deltas={deltas}
        currentLabel={`${curShort}${span}`}
        previousLabel={`${prevShort}${span}`}
      />
    </ChartCard>
  )
}

/* ---------- Bubs vs Meow ---------- */

function PeopleCard({
  month,
  expenses,
  activeMonths,
  partialLast,
}: {
  month: MonthKey
  expenses: Expense[]
  activeMonths: MonthKey[]
  partialLast: boolean
}) {
  const rows = personByMonth(expenses, activeMonths)
  const current = rows.find((r) => r.month === month) ?? rows[rows.length - 1]
  const total = personIds().reduce((a, p) => a + (current.by[p] ?? 0), 0)
  const share = (p: Person) =>
    total > 0 ? Math.round(((current.by[p] ?? 0) / total) * 100) : 0

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {personIds().map((p) => (
        <LegendItem key={p} color={personColor(p)} label={personLabel(p)} shape="line" />
      ))}
      {partialLast && rows.length > 1 && (
        <LegendItem color={CHART.textMuted} label="Month in progress" shape="dashed" />
      )}
    </div>
  )

  const headline =
    total > 0 ? (
      <>
        {formatMonthName(month)}:{' '}
        {personIds().map((p, i) => (
          <span key={p}>
            {i > 0 && ' · '}
            {personLabel(p)} <strong>{share(p)}%</strong>
          </span>
        ))}
      </>
    ) : undefined

  const table = {
    head: ['Month', ...personIds().map((p) => personLabel(p))],
    rows: rows.map((r) => [formatMonthName(r.month), ...personIds().map((p) => formatAmount((r.by[p] ?? 0)))]),
  }

  if (rows.length < 2) {
    // a single month isn't a trend — show the split as a meter instead of a two-point line
    return (
      <ChartCard title="Who spent what" headline={headline} legend={legend} table={table}>
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
          {personIds().map((p) => (
            <span
              key={p}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${share(p)}%`, backgroundColor: personColor(p) }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">The trend line appears after a second month.</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Who spent what" headline={headline} legend={legend} table={table}>
      <PersonLines rows={rows} monthLabel={formatMonthShort} partialLast={partialLast} />
    </ChartCard>
  )
}

/* ---------- weekday habits ---------- */

function WeekdayCard({ expenses, months }: { expenses: Expense[]; months: MonthKey[] }) {
  // everyday habits: rent and other big one-offs would otherwise crown whichever
  // weekday they happened to fall on
  const everyday = expenses.filter((e) => e.amount < WEEKDAY_EXCLUDE_FROM)
  const excluded = expenses.length - everyday.length
  const averages = weekdayAverages(everyday, months)
  const top = averages.reduce((a, b) => (b.average > a.average ? b : a))

  return (
    <ChartCard
      title="Everyday spending by weekday"
      headline={
        top.average > 0 ? (
          <>
            Your priciest day is <strong>{WEEKDAY_NAMES[top.weekday]}</strong>, about{' '}
            {formatMoneyWhole(top.average)} on average.
          </>
        ) : undefined
      }
      table={{
        head: ['Day', 'Average'],
        rows: averages.map((a) => [WEEKDAY_NAMES[a.weekday], formatAmount(a.average)]),
      }}
    >
      <ColumnChart
        ariaLabel="Average spending per weekday"
        emphasize={String(top.weekday)}
        columns={averages.map((a) => ({
          key: String(a.weekday),
          label: WEEKDAY_LABELS[a.weekday],
          value: a.average,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{WEEKDAY_NAMES[a.weekday]}s</p>
              <TooltipRow label="Average" value={formatMoneyWhole(a.average)} />
            </>
          ),
        }))}
      />
      <p className="mt-1 text-xs text-muted">
        Average per day since your first expense, over the last {months.length} months.
        {excluded > 0 &&
          ` Leaves out ${excluded} ${excluded === 1 ? 'expense' : 'expenses'} of ${formatAmount(
            WEEKDAY_EXCLUDE_FROM,
          )} ${CURRENCY_SUFFIX} or more, like rent.`}
      </p>
    </ChartCard>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-3xl bg-white/5 p-5 text-center text-sm text-muted ring-1 ring-white/10">
      {children}
    </p>
  )
}
