import { CaretRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useBudgetAlerts } from '../../hooks/useBudgetAlerts'
import { useMonthlyExpensesBetween } from '../../hooks/useExpenses'
import { useIncomesBetween } from '../../hooks/useIncomes'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { usePrefs } from '../../hooks/usePrefs'
import { usePrimaryGoal, useSavingsOverview } from '../../hooks/useSavings'
import {
  currentMonthKey,
  daysInMonth,
  formatMoney,
  formatMoneyCompact,
  formatMoneyWhole,
  formatMonthName,
  formatMonthShort,
  monthRange,
  roundMoney,
  shiftMonth,
  sumExpenses,
  todayKey,
} from '../../lib/calculations'
import { ownCategories, ownExpenses } from '../../lib/allowance'
import { monthForecast } from '../../lib/forecast'
import {
  categoryDeltas,
  categorySlices,
  elapsedDays,
  monthsEndingAt,
  pacePoints,
  topCategories,
  windowRange,
} from '../../lib/insights'
import { type Category, type Expense, type Person } from '../../types'
import { AlertList } from '../alerts/AlertList'
import { TooltipRow } from '../charts/ChartCard'
import { CategoryDeltaBars } from '../charts/CategoryDeltaBars'
import { ColumnChart } from '../charts/ColumnChart'
import { PaceChart } from '../charts/PaceChart'
import { SpendDonut } from '../charts/SpendDonut'
import { ForecastCard } from '../ForecastCard'
import { PaySplitCard } from '../PaySplitCard'
import { TopCategoriesList } from '../TopCategoriesList'
import { useBillCategoryIds, usePaySplit } from '../../hooks/usePaySplit'
import type { Widget } from './WidgetCarousel'
import { personColor, personIds, personLabel } from '../../lib/people'
import { dateFormat, t } from '../../i18n'

/** Every widget the Add screen can show, in order; each can be switched off in Settings. */
const widget = <Id extends string>(id: Id) => ({
  id,
  label: () => t(`widgets.${id as AddWidgetKey}.label`),
  help: () => t(`widgets.${id as AddWidgetKey}.help`),
})
type AddWidgetKey =
  | 'donut'
  | 'top'
  | 'pay'
  | 'pace'
  | 'alerts'
  | 'delta'
  | 'forecast'
  | 'people'
  | 'goals'
  | 'week'

export const ADD_WIDGETS = [
  widget('donut'),
  widget('top'),
  widget('pay'),
  widget('pace'),
  widget('alerts'),
  widget('delta'),
  widget('forecast'),
  widget('people'),
  widget('goals'),
  widget('week'),
] as const

export type AddWidgetId = (typeof ADD_WIDGETS)[number]['id']

/** Rows at most in the "vs last month" list: the biggest swings. */
const DELTA_ROWS = 5
/** Months of paychecks the forecast learns a typical month from. */
const INCOME_MONTHS = 6
/** Plot height of the charts in the widgets, smaller than in Insights. */
const PLOT = 96

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-6 text-center text-sm text-muted">{children}</p>
)

/**
 * The widgets above the Add tiles, the switched-off ones left out. Monthly
 * numbers only: spending from goals is paid from savings.
 */
export function useAddWidgets({
  expenses,
  categories,
  allCategories,
}: {
  /** This month's expenses, without goals. */
  expenses: Expense[]
  /** This month's categories, limits from its plan, hidden ones left out. */
  categories: Category[]
  /** Hidden ones included, for naming old expenses. */
  allCategories: Category[]
}): Widget[] {
  const month = currentMonthKey()
  const prev = shiftMonth(month, -1)
  const prefs = usePrefs()
  const { person: me } = useDeviceUser()
  // category by category, the other one's allowance isn't shown
  const own = ownCategories(allCategories, me)
  const { alerts, dismiss } = useBudgetAlerts()
  const { data: twoMonths = [] } = useMonthlyExpensesBetween(
    monthRange(prev).from,
    monthRange(month).to,
  )
  const incomeWindow = windowRange(monthsEndingAt(month, INCOME_MONTHS))
  const { data: incomes = [] } = useIncomesBetween(incomeWindow.from, incomeWindow.to)
  const { data: goal } = usePrimaryGoal()
  const savings = useSavingsOverview()
  // the month and the three before it, for what a category usually costs
  const { data: fourMonths = [] } = useMonthlyExpensesBetween(
    monthRange(shiftMonth(month, -3)).from,
    monthRange(month).to,
  )
  const paySplit = usePaySplit(month)
  const billCategoryIds = useBillCategoryIds()
  // fixed costs once, everyday spending by the day (see projectSpend)
  const forecast = monthForecast({
    month,
    isCurrent: true,
    expenses: fourMonths.length > 0 ? fourMonths : expenses,
    incomes,
    goal,
    categories: allCategories.filter((c) => c.kind !== 'project'),
    billCategoryIds,
  })

  const monthTotal = sumExpenses(expenses)
  const monthLimit = categories.reduce((a, c) => a + c.monthly_limit, 0)

  const all: Record<AddWidgetId, () => ReactNode> = {
    donut: () => (
      <DonutWidget expenses={ownExpenses(expenses, allCategories, me)} categories={own} />
    ),
    top: () => <TopWidget expenses={ownExpenses(fourMonths, allCategories, me)} categories={own} />,
    pay: () =>
      paySplit ? (
        <PaySplitCard split={paySplit} monthName={formatMonthName(month)} bare />
      ) : null,
    pace: () => (
      <>
        <p className="text-sm leading-snug text-slate-200">
          {paceLine(monthTotal, forecast.projectedSpend, monthLimit)}
        </p>
        <PaceChart
          month={month}
          points={pacePoints(expenses, month, monthLimit)}
          showPace={monthLimit > 0}
          plotHeight={PLOT}
        />
      </>
    ),
    alerts: () =>
      alerts.length > 0 ? (
        <div className="max-h-48 overflow-y-auto">
          <AlertList alerts={alerts} onDismiss={dismiss} />
        </div>
      ) : (
        <Empty>{t('widgets.alerts.empty')}</Empty>
      ),
    delta: () => (
      <DeltaWidget
        expenses={ownExpenses(twoMonths, allCategories, me)}
        categories={own}
        month={month}
      />
    ),
    forecast: () => (
      <ForecastCard
        forecast={forecast}
        isCurrent
        goal={goal}
        bare
      />
    ),
    people: () => <PeopleWidget expenses={expenses} />,
    goals: () => <GoalsWidget goals={savings.goals.filter((g) => !g.goal.archived)} />,
    week: () => <WeekWidget expenses={twoMonths} dailyLimit={monthLimit / daysInMonth(month)} />,
  }

  // who spent what means nothing with one person in the budget
  const solo = personIds().length < 2
  return ADD_WIDGETS.filter(
    (w) => !prefs.hiddenWidgets.includes(w.id) && !(solo && w.id === 'people'),
  ).map((w) => ({
    id: w.id,
    label: w.label(),
    badge: w.id === 'alerts' ? alerts.length : undefined,
    content: all[w.id](),
  }))
}

/* ---------- the widgets ---------- */

function DonutWidget({ expenses, categories }: { expenses: Expense[]; categories: Category[] }) {
  const slices = categorySlices(expenses, categories)
  if (slices.length === 0) return <Empty>{t('widgets.nothingSpent')}</Empty>
  const spent = new Map<string, number>()
  for (const e of expenses) spent.set(e.category_id, (spent.get(e.category_id) ?? 0) + e.amount)
  // switched out of the donut in Settings (rent and the like), but spent on this month
  const leftOut = categories.filter((c) => !c.show_in_chart && (spent.get(c.id) ?? 0) > 0)
  return (
    <>
      <SpendDonut slices={slices} />
      {leftOut.length > 0 && (
        <p className="mt-2 truncate text-xs text-muted">
          {t('widgets.donut.leftOut', {
            list: leftOut
              .map((c) => `${c.name} ${formatMoneyCompact(Math.round(spent.get(c.id)!))}`)
              .join(' · '),
          })}
        </p>
      )}
    </>
  )
}

function TopWidget({ expenses, categories }: { expenses: Expense[]; categories: Category[] }) {
  const top = topCategories(expenses, categories, currentMonthKey())
  if (top.length === 0) return <Empty>{t('widgets.nothingSpent')}</Empty>
  return (
    <div className="pt-1">
      <TopCategoriesList top={top} isCurrent />
    </div>
  )
}

/** Like for like: this month so far against the same days of last month. */
function DeltaWidget({
  expenses,
  categories,
  month,
}: {
  expenses: Expense[]
  categories: Category[]
  month: string
}) {
  const prev = shiftMonth(month, -1)
  const cutoff = Math.min(elapsedDays(month), daysInMonth(prev))
  const deltas = categoryDeltas(expenses, categories, month, cutoff)
  if (!deltas.some((d) => d.previous > 0)) return <Empty>{t('widgets.delta.empty')}</Empty>
  const change = roundMoney(deltas.reduce((a, d) => a + d.delta, 0))
  const span = ` 1–${cutoff}`
  return (
    <>
      <p className="mb-2 text-sm leading-snug text-slate-200">
        {t(change === 0 ? 'widgets.delta.same' : change > 0 ? 'widgets.delta.more' : 'widgets.delta.less', {
          amount: formatMoneyWhole(Math.abs(change)),
          count: cutoff,
          month: formatMonthShort(prev),
        })}
      </p>
      <CategoryDeltaBars
        deltas={deltas.slice(0, DELTA_ROWS)}
        currentLabel={`${formatMonthShort(month)}${span}`}
        previousLabel={`${formatMonthShort(prev)}${span}`}
      />
    </>
  )
}

function PeopleWidget({ expenses }: { expenses: Expense[] }) {
  const by = Object.fromEntries(
    personIds().map((p) => [p, roundMoney(sumExpenses(expenses.filter((e) => e.person === p)))]),
  ) as Record<Person, number>
  const total = personIds().reduce((a, p) => a + by[p], 0)
  if (total <= 0) return <Empty>{t('widgets.nothingSpent')}</Empty>
  return (
    <div className="space-y-3 pt-1">
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
        {personIds().map((p) => (
          <div
            key={p}
            style={{ width: `${(by[p] / total) * 100}%`, backgroundColor: personColor(p) }}
          />
        ))}
      </div>
      <ul className="grid gap-2">
        {personIds().map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: personColor(p) }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-200">{personLabel(p)}</span>
            <span className="tabular-nums text-muted">{Math.round((by[p] / total) * 100)}%</span>
            <span className="w-24 text-right font-semibold tabular-nums text-white">
              {formatMoneyWhole(by[p])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GoalsWidget({ goals }: { goals: ReturnType<typeof useSavingsOverview>['goals'] }) {
  if (goals.length === 0) return <Empty>{t('widgets.goals.empty')}</Empty>
  return (
    <ul className="grid max-h-48 gap-1 overflow-y-auto">
      {goals.map(({ goal, saved, progress }) => (
        <li key={goal.id}>
          <Link
            to={`/savings/goal/${goal.id}`}
            className="group block rounded-xl px-1 py-1.5 hover:bg-white/5"
          >
            <span className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-200">{goal.name}</span>
              <span className="shrink-0 tabular-nums text-white">
                {formatMoneyWhole(saved)}
                {goal.target_amount > 0 && (
                  <span className="text-muted"> / {formatMoneyWhole(goal.target_amount)}</span>
                )}
              </span>
              <CaretRight aria-hidden className="shrink-0 self-center text-muted" />
            </span>
            {progress !== null && (
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${progress * 100}%`, backgroundColor: goal.color }}
                />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

const weekday = () => dateFormat({ weekday: 'short' })
const dayLong = () => dateFormat({ weekday: 'long', day: 'numeric', month: 'short' })

function WeekWidget({ expenses, dailyLimit }: { expenses: Expense[]; dailyLimit: number }) {
  const [y, m, d] = todayKey().split('-').map(Number)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(y, m - 1, d - 6 + i)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { key, date }
  })
  const total = new Map<string, number>()
  for (const e of expenses) total.set(e.expense_date, (total.get(e.expense_date) ?? 0) + e.amount)
  const week = roundMoney(days.reduce((a, day) => a + (total.get(day.key) ?? 0), 0))
  return (
    <>
      <p className="text-sm leading-snug text-slate-200">
        {dailyLimit > 0
          ? t('widgets.week.summaryWithLimit', {
              amount: formatMoneyWhole(week),
              share: formatMoneyWhole(dailyLimit * 7),
            })
          : t('widgets.week.summary', { amount: formatMoneyWhole(week) })}
      </p>
      <ColumnChart
        ariaLabel={t('widgets.week.chartLabel')}
        emphasize={days[6].key}
        plotHeight={PLOT}
        reference={dailyLimit > 0 ? { value: dailyLimit, label: t('common.perDay') } : undefined}
        columns={days.map(({ key, date }) => ({
          key,
          label: weekday().format(date),
          value: roundMoney(total.get(key) ?? 0),
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{dayLong().format(date)}</p>
              <TooltipRow label={t('common.spent')} value={formatMoney(total.get(key) ?? 0)} />
            </>
          ),
        }))}
      />
    </>
  )
}

/** The month's pace in a sentence: where the total is heading against the limits. */
function paceLine(spent: number, projected: number | null, limit: number): string {
  if (projected === null || limit <= 0)
    return t('widgets.pace.soFar', { amount: formatMoneyCompact(spent) })
  const diff = projected - limit
  return diff > 0
    ? t('widgets.pace.over', { amount: formatMoneyCompact(diff) })
    : t('widgets.pace.under', {
        projected: formatMoneyCompact(projected),
        amount: formatMoneyCompact(-diff),
      })
}
