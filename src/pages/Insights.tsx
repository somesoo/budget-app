import { CaretDown, CaretRight, CaretUp, Check, Warning } from '@phosphor-icons/react'
import { useFeatures } from '../hooks/usePrefs'
import { useState, type ReactNode } from 'react'
import { AdviceCard } from '../components/AdviceCard'
import { AskLink } from '../components/AskLink'
import { useBudgetAlerts } from '../hooks/useBudgetAlerts'
import { useProjectSummaries } from '../hooks/useProjectSummaries'
import type { BudgetAlert } from '../lib/alerts'
import type { ProjectSummary } from '../lib/projects'
import { ForecastCard } from '../components/ForecastCard'
import { FireCard } from '../components/FireCard'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { CategoryDeltaBars } from '../components/charts/CategoryDeltaBars'
import { ChartCard, LegendItem, TooltipRow } from '../components/charts/ChartCard'
import { ColumnChart } from '../components/charts/ColumnChart'
import { PaceChart } from '../components/charts/PaceChart'
import { PersonLines } from '../components/charts/PersonLines'
import { SpendDonut } from '../components/charts/SpendDonut'
import { TopCategoriesList, sharePercent } from '../components/TopCategoriesList'
import { PaySplitCard } from '../components/PaySplitCard'
import { useBillCategoryIds, usePaySplit } from '../hooks/usePaySplit'
import { CHART } from '../components/charts/theme'
import {
  CURRENCY_SUFFIX,
  INSIGHTS_MONTHS,
  WEEKDAY_EXCLUDE_FROM,
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
  monthRange,
  shiftMonth,
  sumByCategory,
  sumExpenses,
  weekdayNames,
  type MonthKey,
} from '../lib/calculations'
import {
  categoryDeltas,
  categorySlices,
  elapsedDays,
  monthlyTotals,
  monthsEndingAt,
  pacePoints,
  personByMonth,
  topCategories,
  trimLeadingEmpty,
  weekdayAverages,
  windowRange,
} from '../lib/insights'
import { type Category, type Expense, type Goal, type Income, type Person } from '../types'
import { personColor, personIds, personLabel } from '../lib/people'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'
import { Link } from 'react-router-dom'
import { useChapters } from '../hooks/useChapters'
import { EARLIER_ID, chapterSpans } from '../lib/chapters'
import { incomeByMonth, incomeTrend } from '../lib/income'
import { spanDates, spanName } from '../components/settings/ChaptersCard'

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
      title={t('nav.insights')}
      wide
      action={
        <div className="flex items-center gap-2">
          <AskLink question={t('insights.askQuestion', { month: formatMonthName(month) })} />
          <MonthSwitcher month={month} onChange={setMonth} />
        </div>
      }
    >
      {error ? (
        <Notice>{t('insights.loadFailed', { error: (error as Error).message })}</Notice>
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
      <IncomeLink />
      <ChapterLinks />
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
  const billCategoryIds = useBillCategoryIds()
  const shows = useFeatures()
  const activeMonths = trimLeadingEmpty(expenses, months)
  if (activeMonths.length === 0) {
    return <Notice>{t('insights.empty')}</Notice>
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

  const points = pacePoints(expenses, month, totalLimit)
  const forecast = monthForecast({
    month,
    isCurrent,
    expenses,
    incomes,
    goal,
    categories,
    billCategoryIds,
  })
  // rent paid on the 1st counts once: the same projection as the forecast's
  const projected = forecast.projectedSpend

  // Recommendations first, across the page. Then phone: one column, top to
  // bottom; laptop: this month on the left, comparisons on the right.
  return (
    <div className="space-y-4">
      {shows('ai') && (
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
      )}
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

          <PaySplitSection month={month} />

          <ForecastCard forecast={forecast} isCurrent={isCurrent} goal={goal} />

          {isCurrent && shows('fire') && <FireCard />}

          {shows('charts') && (
            <>
              <ChartCard
                title={isCurrent ? t('insights.paceTitle') : t('insights.paceThrough', { month: monthName })}
                headline={paceHeadline(spent, projected, totalLimit, isCurrent, monthName)}
                legend={
                  totalLimit > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <LegendItem
                        color={CHART.accent}
                        label={isCurrent ? t('forecast.spentSoFar') : t('common.spent')}
                        shape="line"
                      />
                      <LegendItem
                        color={CHART.textMuted}
                        label={t('insights.evenSpread')}
                        shape="dashed"
                      />
                    </div>
                  )
                }
                table={{
                  head: [t('insights.day'), t('insights.spentToDate'), t('charts.pace')],
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
            </>
          )}
        </div>

        <div className="space-y-4">
          <StructureCard
            month={month}
            expenses={ownExpenses(inMonth(month), categories, me)}
            categories={ownCategories(categories, me)}
          />

          <TopCard
            month={month}
            isCurrent={isCurrent}
            expenses={ownExpenses(expenses, categories, me)}
            categories={ownCategories(categories, me)}
          />

          {shows('charts') && (
            <>
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
            </>
          )}
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
        <p className="text-xs text-muted">
          {isCurrent ? t('insights.projectedEnd') : t('common.spent')}
        </p>
        <p className="mt-0.5 text-xl font-bold text-white">
          {headlineValue === null
            ? t('category.noData')
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
                {t('insights.overLimits', {
                  amount: formatAmount(Math.round(headlineValue - totalLimit)),
                })}
              </>
            ) : (
              <>
                <Check weight="bold" aria-hidden className="inline-block align-[-0.125em]" />{' '}
                {t('insights.withinLimits', { amount: formatAmount(totalLimit) })}
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
          {sameSpan
            ? t('insights.vsSameDays', { month: prevName })
            : t('insights.vs', { month: prevName })}
        </p>
        {change === null ? (
          <p className="mt-0.5 text-sm text-muted">{t('insights.noDataFor', { month: prevName })}</p>
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
              {change > 0
                ? t('insights.moreThanLast')
                : change < 0
                  ? t('insights.lessThanLast')
                  : t('insights.sameAsLast')}
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
      return t('insights.youSpent', { amount: formatMoney(spent), month: monthName })
    const diff = spent - totalLimit
    return diff > 0
      ? t('insights.endedOver', { month: monthName, amount: formatMoney(diff) })
      : t('insights.endedUnder', { month: monthName, amount: formatMoney(-diff) })
  }
  if (projected === null || totalLimit <= 0)
    return t('widgets.pace.soFar', { amount: formatMoney(spent) })
  const diff = projected - totalLimit
  return (
    <Trans
      k={diff > 0 ? 'insights.finishOver' : 'insights.finishUnder'}
      values={{ amount: formatMoneyWhole(Math.abs(diff)) }}
      tags={{ b: (s) => <strong>{s}</strong> }}
    />
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
      <ChartCard title={t('insights.monthByMonth')}>
        <p className="text-sm text-muted">
          {t('insights.monthByMonthEmpty')}
        </p>
      </ChartCard>
    )
  }

  const selected = totals.find((row) => row.month === month)!
  const others = totals.filter((row) => row.month !== month && row.total > 0)
  const average = others.length ? others.reduce((a, row) => a + row.total, 0) / others.length : 0
  const comparable = projected ?? selected.total
  const vsAvg = average > 0 ? (comparable - average) / average : null

  return (
    <ChartCard
      title={t('insights.monthByMonth')}
      headline={
        vsAvg === null ? undefined : (
          <Trans
            k={
              projected !== null
                ? vsAvg >= 0
                  ? 'insights.onCourseAbove'
                  : 'insights.onCourseBelow'
                : vsAvg >= 0
                  ? 'insights.wasAbove'
                  : 'insights.wasBelow'
            }
            values={{ month: formatMonthName(month), percent: Math.abs(Math.round(vsAvg * 100)) }}
            tags={{ b: (s) => <strong>{s}</strong> }}
          />
        )
      }
      legend={
        totalLimit > 0 && (
          <LegendItem color={CHART.textMuted} label={t('insights.monthlyLimits')} shape="dashed" />
        )
      }
      table={{
        head: [t('insights.month'), t('common.spent')],
        rows: totals.map((row) => [formatMonthName(row.month), formatAmount(row.total)]),
      }}
    >
      <ColumnChart
        ariaLabel={t('insights.totalChartLabel')}
        emphasize={month}
        reference={totalLimit > 0 ? { value: totalLimit, label: t('insights.limitsShort') } : undefined}
        columns={totals.map((row) => ({
          key: row.month,
          label: formatMonthShort(row.month),
          value: row.total,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{formatMonthName(row.month)}</p>
              <TooltipRow
                label={row.month === month && projected !== null ? t('insights.soFar') : t('common.spent')}
                value={formatMoney(row.total)}
              />
              {row.month === month && projected !== null && (
                <TooltipRow label={t('category.projected')} value={formatMoneyWhole(projected)} />
              )}
              {totalLimit > 0 && (
                <TooltipRow label={t('planner.limits')} value={formatMoney(totalLimit)} />
              )}
            </>
          ),
        }))}
      />
    </ChartCard>
  )
}

/* ---------- where the pay went ---------- */

function PaySplitSection({ month }: { month: MonthKey }) {
  const split = usePaySplit(month)
  if (!split) return null
  return <PaySplitCard split={split} monthName={formatMonthName(month)} />
}

/* ---------- where the money went ---------- */

function StructureCard({
  month,
  expenses,
  categories,
}: {
  month: MonthKey
  /** The selected month's only. */
  expenses: Expense[]
  categories: Category[]
}) {
  const slices = categorySlices(expenses, categories)
  if (slices.length === 0) return null
  const byCategory = sumByCategory(expenses)
  // switched out of the donut in Settings (rent and the like), but spent on this month
  const leftOut = categories.filter((c) => !c.show_in_chart && (byCategory[c.id] ?? 0) > 0)

  return (
    <ChartCard
      title={t('insights.structureTitle')}
      headline={
        <Trans
          k="insights.structureHeadline"
          values={{
            name: slices[0].name,
            share: sharePercent(slices[0].share),
            month: formatMonthName(month),
          }}
          tags={{ b: (s) => <strong>{s}</strong> }}
        />
      }
      table={{
        head: [t('entry.category'), t('common.spent'), t('insights.share')],
        rows: slices.map((sl) => [sl.name, formatAmount(sl.amount), sharePercent(sl.share)]),
      }}
    >
      <SpendDonut slices={slices} />
      {leftOut.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {t('widgets.donut.leftOut', {
            list: leftOut
              .map((c) => `${c.name} ${formatMoneyWhole(byCategory[c.id])}`)
              .join(' · '),
          })}
        </p>
      )}
    </ChartCard>
  )
}

/* ---------- the three biggest ---------- */

function TopCard({
  month,
  isCurrent,
  expenses,
  categories,
}: {
  month: MonthKey
  isCurrent: boolean
  expenses: Expense[]
  categories: Category[]
}) {
  const top = topCategories(expenses, categories, month)
  if (top.length === 0) return null
  const together = top.reduce((acc, r) => acc + r.share, 0)

  return (
    <ChartCard
      title={t('insights.topTitle')}
      headline={top.length > 1 ? t('insights.topHeadline', { share: sharePercent(together) }) : undefined}
      table={{
        head: [t('entry.category'), t('common.spent'), t('insights.share'), t('insights.typical')],
        rows: top.map((r) => [
          r.category.name,
          formatAmount(r.amount),
          sharePercent(r.share),
          r.typical === null ? '–' : formatAmount(r.typical),
        ]),
      }}
    >
      <TopCategoriesList top={top} isCurrent={isCurrent} />
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
      <ChartCard title={t('insights.changeByCategory')}>
        <p className="text-sm text-muted">
          {t('insights.changeEmpty', { month: prevName })}
        </p>
      </ChartCard>
    )
  }

  const biggestUp = deltas.find((d) => d.delta > 0)
  const biggestDown = [...deltas].sort((a, b) => a.delta - b.delta).find((d) => d.delta < 0)

  return (
    <ChartCard
      title={t('insights.changeByCategory')}
      headline={
        biggestUp ? (
          <Trans
            k={dayCutoff !== undefined ? 'insights.biggestJumpSameDays' : 'insights.biggestJump'}
            values={{
              name: biggestUp.category.name,
              amount: formatMoney(biggestUp.delta),
              month: prevName,
            }}
            tags={{ b: (s) => <strong>{s}</strong> }}
          />
        ) : biggestDown ? (
          <Trans
            k="insights.allDown"
            values={{ name: biggestDown.category.name }}
            tags={{ b: (s) => <strong>{s}</strong> }}
          />
        ) : undefined
      }
      legend={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem
            color={CHART.more}
            label={t('insights.moreThan', { month: `${prevShort}${span}` })}
            shape="rect"
          />
          <LegendItem color={CHART.less} label={t('insights.less')} shape="rect" />
        </div>
      }
      table={{
        head: [
          t('entry.category'),
          `${curShort}${span}`,
          `${prevShort}${span}`,
          t('insights.change'),
        ],
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
        <LegendItem color={CHART.textMuted} label={t('insights.inProgress')} shape="dashed" />
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
    head: [t('insights.month'), ...personIds().map((p) => personLabel(p))],
    rows: rows.map((r) => [formatMonthName(r.month), ...personIds().map((p) => formatAmount((r.by[p] ?? 0)))]),
  }

  if (rows.length < 2) {
    // a single month isn't a trend — show the split as a meter instead of a two-point line
    return (
      <ChartCard
        title={t('insights.whoSpent')}
        headline={headline}
        legend={legend}
        table={table}
      >
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
          {personIds().map((p) => (
            <span
              key={p}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${share(p)}%`, backgroundColor: personColor(p) }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t('insights.trendLater')}</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard
        title={t('insights.whoSpent')}
        headline={headline}
        legend={legend}
        table={table}
      >
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
  const shortNames = weekdayNames('short')
  const longNames = weekdayNames('long')

  return (
    <ChartCard
      title={t('insights.weekdayTitle')}
      headline={
        top.average > 0 ? (
          <Trans
            k="insights.priciestDay"
            values={{ day: longNames[top.weekday], amount: formatMoneyWhole(top.average) }}
            tags={{ b: (s) => <strong>{s}</strong> }}
          />
        ) : undefined
      }
      table={{
        head: [t('insights.day'), t('insights.average')],
        rows: averages.map((a) => [longNames[a.weekday], formatAmount(a.average)]),
      }}
    >
      <ColumnChart
        ariaLabel={t('insights.weekdayChartLabel')}
        emphasize={String(top.weekday)}
        columns={averages.map((a) => ({
          key: String(a.weekday),
          label: shortNames[a.weekday],
          value: a.average,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{longNames[a.weekday]}</p>
              <TooltipRow label={t('insights.average')} value={formatMoneyWhole(a.average)} />
            </>
          ),
        }))}
      />
      <p className="mt-1 text-xs text-muted">
        {t('insights.weekdayNote', { count: months.length })}
        {excluded > 0 &&
          ` ${t('insights.weekdayExcluded', {
            count: excluded,
            amount: `${formatAmount(WEEKDAY_EXCLUDE_FROM)} ${CURRENCY_SUFFIX}`,
          })}`}
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

/* ---------- money in ---------- */

/** Pay over the last year against the one before, and the way to every income. */
function IncomeLink() {
  const now = currentMonthKey()
  const from = shiftMonth(now, -23)
  const { data: incomes } = useIncomesBetween(monthRange(from).from, monthRange(now).to)
  const trend = incomes ? incomeTrend(incomeByMonth(incomes, from, now)) : null
  return (
    <Link
      to="/income"
      className="mt-4 flex items-center gap-3 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 hover:bg-white/[0.06]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-white">{t('incomePage.title')}</span>
        <span className="block text-sm text-muted">
          {trend?.recent != null
            ? trend.change !== null
              ? t('incomePage.linkTrend', {
                  amount: formatMoneyWhole(trend.recent),
                  change: `${trend.change >= 0 ? '+' : '−'}${Math.abs(Math.round(trend.change * 100))}%`,
                })
              : t('incomePage.linkAverage', { amount: formatMoneyWhole(trend.recent) })
            : t('incomePage.linkEmpty')}
        </span>
      </span>
      <CaretRight className="shrink-0 text-muted" aria-hidden />
    </Link>
  )
}

/* ---------- chapters ---------- */

/** Once the budget has chapters, each one's summary is a tap away from here. */
function ChapterLinks() {
  const { data } = useChapters()
  const spans = data ? chapterSpans(data.chapters) : []
  if (spans.length === 0) return null
  return (
    <section className="mt-4 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <h2 className="text-base font-semibold text-white">{t('chapters.title')}</h2>
      <ul className="mt-1 divide-y divide-white/5">
        {spans.map((span) => (
          <li key={span.id ?? EARLIER_ID}>
            <Link
              to={`/chapter/${span.id ?? EARLIER_ID}`}
              className="flex items-center gap-2 py-2.5 hover:bg-white/5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-white">{spanName(span, spans)}</span>
                <span className="block truncate text-xs text-muted">{spanDates(span)}</span>
              </span>
              <span className="text-xs font-semibold text-accent-soft">{t('chapters.summary')}</span>
              <CaretRight className="shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
