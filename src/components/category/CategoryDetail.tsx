import { useState, type ReactNode } from 'react'
import { CURRENCY_SUFFIX } from '../../config'
import { useMonthCategories } from '../../hooks/useBudgets'
import { useMonthlyExpensesBetween } from '../../hooks/useExpenses'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useBillCategoryIds } from '../../hooks/usePaySplit'
import { isOthersAllowance, ownCategories, ownExpenses } from '../../lib/allowance'
import {
  categoryById,
  currentMonthKey,
  daysInMonth,
  formatAmount,
  formatMoney,
  formatMoneyWhole,
  formatMonth,
  formatMonthName,
  formatMonthShort,
  monthKeyOfDate,
  sumExpenses,
  type MonthKey,
} from '../../lib/calculations'
import {
  amountsOver,
  categoryHistory,
  detailWindow,
  shareRows,
  type CategoryHistory,
} from '../../lib/categoryDetail'
import { toEntries } from '../../lib/history'
import { elapsedDays, pacePoints, windowRange } from '../../lib/insights'
import { isFixedGroup } from '../../lib/paySplit'
import { projectSpend } from '../../lib/projection'
import type { Category, Expense } from '../../types'
import { LegendItem, TooltipRow } from '../charts/ChartCard'
import { ColumnChart } from '../charts/ColumnChart'
import { PaceChart } from '../charts/PaceChart'
import { CHART } from '../charts/theme'
import { EntryRow } from '../history/EntryRow'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'

interface Props {
  categoryId: string
  month: MonthKey
  /** In the planner: the limits being drafted, which win over the saved plan. */
  draftLimits?: Record<string, number>
  /** In the planner: an input for this category's limit, shown with the forecast. */
  limitEditor?: ReactNode
  /** In the planner: suggestions for this category, under the limit. */
  planExtras?: ReactNode
  /** Makes the rows of the share pane jump to that category. */
  onSelectCategory?: (id: string) => void
}

/**
 * One category, in three panes. On a laptop the screen splits: the whole left
 * side is its history, the right side is the forecast on top and its share of
 * the spending below. On a phone the three stack, history last, since its
 * list of expenses runs long.
 */
export function CategoryDetail({
  categoryId,
  month,
  draftLimits,
  limitEditor,
  planExtras,
  onSelectCategory,
}: Props) {
  const { from, to } = windowRange(detailWindow(month))
  const { data: monthCategories, isLoading: categoriesLoading } = useMonthCategories(month)
  const { data: expenses, error } = useMonthlyExpensesBetween(from, to)
  const { person: me } = useDeviceUser()

  if (error) return <Notice>Could not load expenses: {(error as Error).message}</Notice>
  if (categoriesLoading || !monthCategories || !expenses) return <Skeleton />

  const categories = draftLimits
    ? monthCategories.map((c) =>
        c.id in draftLimits ? { ...c, monthly_limit: draftLimits[c.id] } : c,
      )
    : monthCategories
  const category = categories.find((c) => c.id === categoryId)
  if (!category) return <Notice>{t('category.gone')}</Notice>
  if (isOthersAllowance(category, me))
    return <Notice>{t('category.othersAllowance', { name: category.name })}</Notice>

  const history = categoryHistory(expenses, categoryId, month)

  return (
    <div className="grid grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
      <HistoryPane
        key={category.id}
        category={category}
        month={month}
        history={history}
        categories={categories}
      />
      {/* sized to its content: a cut-off chart reads as broken; the share list below scrolls instead */}
      <ForecastPane
        category={category}
        month={month}
        history={history}
        limitEditor={limitEditor}
        extras={planExtras}
      />
      <SharePane
        category={category}
        month={month}
        categories={ownCategories(categories, me)}
        expenses={ownExpenses(expenses, categories, me)}
        history={history}
        onSelect={onSelectCategory}
      />
    </div>
  )
}

/* ---------- left: what it cost, month by month ---------- */

function HistoryPane({
  category,
  month,
  history,
  categories,
}: {
  category: Category
  month: MonthKey
  history: CategoryHistory
  categories: Category[]
}) {
  const current = currentMonthKey()
  const byId = categoryById(categories)
  const groups = groupByMonth(history.expenses)
  const [showAll, setShowAll] = useState(false)
  const shownGroups = showAll ? groups : groups.slice(0, LIST_MONTHS)

  if (history.months.length === 0 || history.expenses.length === 0) {
    return (
      <Pane title={t('category.history')} className="order-last lg:order-none lg:row-span-2">
        <Empty>
          {t('category.historyEmpty', { name: category.name, count: history.months.length || 12 })}
        </Empty>
      </Pane>
    )
  }

  return (
    <Pane
      title={t('category.history')}
      aside={t('category.lastMonths', { count: history.months.length })}
      className="order-last lg:order-none lg:row-span-2"
      scroll={false}
    >
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label={t('category.typicalMonth')}
          value={history.typical === null ? t('category.noData') : formatMoneyWhole(history.typical)}
          sub={t('category.last3')}
        />
        <Stat
          label={
            history.previous ? formatMonthName(history.previous.month) : t('category.lastMonth')
          }
          value={
            history.previous ? formatMoneyWhole(history.previous.total) : t('category.noData')
          }
        />
        <Stat
          label={t('category.highest')}
          value={history.peak ? formatMoneyWhole(history.peak.total) : t('category.noData')}
          sub={history.peak ? formatMonth(history.peak.month) : undefined}
        />
      </div>

      <div className="mt-4">
        <ColumnChart
          ariaLabel={t('category.chartLabel', { name: category.name })}
          emphasize={history.months.includes(month) ? month : undefined}
          reference={
            category.monthly_limit > 0
              ? { value: category.monthly_limit, label: t('settings.categories.limit') }
              : undefined
          }
          columns={history.months.map((m, i) => ({
            key: m,
            label: formatMonthShort(m),
            value: history.totals[i],
            tooltip: (
              <>
                <p className="mb-1 text-slate-400">
                  {formatMonth(m)}
                  {m === current ? `, ${t('charts.soFar')}` : ''}
                </p>
                <TooltipRow label={t('common.spent')} value={formatMoney(history.totals[i])} />
              </>
            ),
          }))}
        />
        {category.monthly_limit > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <LegendItem color={CHART.accent} label={formatMonthName(month)} shape="rect" />
            <LegendItem
              color={CHART.textMuted}
              label={t('category.monthLimit', { month: formatMonthName(month) })}
              shape="dashed"
            />
          </div>
        )}
      </div>

      <div className="-mx-2 mt-4 min-h-0 flex-1 border-t border-white/10 pt-3 lg:overflow-y-auto">
        {shownGroups.map((g) => (
          <section key={g.month} className="mb-3">
            <header className="flex items-baseline justify-between px-3 pb-1">
              <h3 className="text-sm font-semibold text-white">{formatMonth(g.month)}</h3>
              <span className="text-xs tabular-nums text-muted">{formatMoney(g.total)}</span>
            </header>
            <ul className="divide-y divide-white/5">
              {toEntries(g.expenses, []).map((entry) => (
                <li key={entry.id}>
                  <EntryRow entry={entry} categories={byId} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length > shownGroups.length && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mx-3 mb-2 rounded-full px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 active:bg-white/10"
          >
            {t('category.showAll', { count: groups.length })}
          </button>
        )}
      </div>
    </Pane>
  )
}

/** Months of expenses listed before "Show all": enough for recent context, short enough to scan. */
const LIST_MONTHS = 3

function groupByMonth(expenses: Expense[]) {
  const groups: { month: MonthKey; expenses: Expense[]; total: number }[] = []
  for (const e of expenses) {
    const m = monthKeyOfDate(e.expense_date)
    let g = groups[groups.length - 1]
    if (!g || g.month !== m) groups.push((g = { month: m, expenses: [], total: 0 }))
    g.expenses.push(e)
  }
  for (const g of groups) g.total = sumExpenses(g.expenses)
  return groups
}

/* ---------- right, top: where the month is heading ---------- */

function ForecastPane({
  category,
  month,
  history,
  limitEditor,
  extras,
}: {
  category: Category
  month: MonthKey
  history: CategoryHistory
  limitEditor?: ReactNode
  extras?: ReactNode
}) {
  const current = currentMonthKey()
  const limit = category.monthly_limit
  // rent and the like are paid at the start: the pace line starts at the limit
  const fixed = isFixedGroup(category, useBillCategoryIds())
  const editor = limitEditor && (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <span className="text-sm font-medium text-white">
        {t('category.limitFor', { month: formatMonthName(month) })}
      </span>
      <div className="w-36 shrink-0">{limitEditor}</div>
    </div>
  )
  const planned = (
    <>
      {editor}
      {extras && <div className="mb-4">{extras}</div>}
    </>
  )

  if (month > current) {
    const columns = [
      history.sameMonthLastYear !== null && history.sameMonthLastYear > 0
        ? {
            key: 'ly',
            label: t('category.lastYear', { month: formatMonthShort(month) }),
            value: history.sameMonthLastYear,
          }
        : null,
      history.previous
        ? {
            key: 'prev',
            label: formatMonthShort(history.previous.month),
            value: history.previous.total,
          }
        : null,
      history.typical !== null
        ? { key: 'typical', label: t('planner.fillTypical'), value: history.typical }
        : null,
      { key: 'plan', label: t('category.plan'), value: limit },
    ].filter((c): c is { key: string; label: string; value: number } => c !== null)

    return (
      <Pane title={t('category.planFor', { month: formatMonthName(month) })}>
        {planned}
        <p className="text-[15px] leading-snug text-white">
          {planHeadline(limit, history.typical)}
        </p>
        <div className="mt-3">
          <ColumnChart
            ariaLabel={t('category.planChartLabel', { name: category.name })}
            emphasize="plan"
            columns={columns.map((c) => ({
              ...c,
              tooltip: <TooltipRow label={c.label} value={formatMoneyWhole(c.value)} />,
            }))}
          />
        </div>
      </Pane>
    )
  }

  const isCurrent = month === current
  const inMonth = history.expenses.filter((e) => monthKeyOfDate(e.expense_date) === month)
  const spent = sumExpenses(inMonth)
  // a fixed cost counts once, everyday spending by the day (see projectSpend)
  const projected = isCurrent
    ? Math.max(
        projectSpend({
          month,
          expenses: history.expenses,
          categories: [category],
          billCategoryIds: new Set(),
        })?.total ?? spent,
        spent,
      )
    : spent
  const daysLeft = isCurrent ? daysInMonth(month) - elapsedDays(month) : 0
  const perDay = limit > spent && daysLeft > 0 ? (limit - spent) / daysLeft : null

  return (
    <Pane
      title={
        isCurrent
          ? t('category.forecastFor', { month: formatMonthName(month) })
          : t('review.title', { month: formatMonthName(month) })
      }
    >
      {planned}
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label={isCurrent ? t('forecast.spentSoFar') : t('common.spent')}
          value={formatMoneyWhole(spent)}
        />
        {isCurrent && (
          <Stat
            label={t('category.projected')}
            value={formatMoneyWhole(projected)}
            tone={limit > 0 && projected > limit ? 'warning' : undefined}
          />
        )}
        <Stat
          label={t('settings.categories.limit')}
          value={limit > 0 ? formatMoneyWhole(limit) : t('category.none')}
        />
      </div>
      <p className="mt-3 text-[15px] leading-snug text-white">
        {forecastHeadline({
          spent,
          projected,
          limit,
          isCurrent,
          monthName: formatMonthName(month),
        })}
        {perDay !== null && (
          <span className="text-slate-300">
            {' '}
            {t('category.perDay', {
              amount: `${formatAmount(Math.floor(perDay))} ${CURRENCY_SUFFIX}`,
            })}
          </span>
        )}
      </p>
      <div className="mt-3">
        <PaceChart month={month} points={pacePoints(inMonth, month, limit, fixed ? limit : 0)} showPace={limit > 0} />
      </div>
    </Pane>
  )
}

function forecastHeadline(args: {
  spent: number
  projected: number
  limit: number
  isCurrent: boolean
  monthName: string
}): string {
  const { spent, projected, limit, isCurrent, monthName } = args
  if (!isCurrent) {
    if (limit <= 0) return t('category.endedAt', { month: monthName, amount: formatMoneyWhole(spent) })
    const diff = spent - limit
    return diff > 0
      ? t('category.endedOver', { amount: formatMoneyWhole(diff) })
      : t('category.endedUnder', { amount: formatMoneyWhole(-diff) })
  }
  if (spent === 0) return t('category.nothingYet')
  if (limit <= 0) return t('category.paceAbout', { amount: formatMoneyWhole(projected) })
  const diff = projected - limit
  return diff > 0
    ? t('category.paceOver', { amount: formatMoneyWhole(diff) })
    : t('category.paceUnder', { amount: formatMoneyWhole(-diff) })
}

function planHeadline(limit: number, typical: number | null): string {
  if (typical === null) return t('category.plannedNoHistory', { amount: formatMoneyWhole(limit) })
  const diff = limit - typical
  if (Math.abs(diff) < 1) return t('category.plannedTypical', { amount: formatMoneyWhole(limit) })
  return diff > 0
    ? t('category.plannedAbove', { amount: formatMoneyWhole(diff) })
    : t('category.plannedBelow', { amount: formatMoneyWhole(-diff) })
}

/* ---------- right, bottom: how big a piece of the whole ---------- */

const SHARE_ROWS = 8

function SharePane({
  category,
  month,
  categories,
  expenses,
  history,
  onSelect,
}: {
  category: Category
  month: MonthKey
  categories: Category[]
  expenses: Expense[]
  history: CategoryHistory
  onSelect?: (id: string) => void
}) {
  const current = currentMonthKey()
  const isFuture = month > current
  const amounts = isFuture
    ? Object.fromEntries(categories.filter((c) => !c.archived).map((c) => [c.id, c.monthly_limit]))
    : amountsOver(expenses, [month])
  const { rows, leftOut } = shareRows(amounts, categories, category.id)

  // what it usually is: the same comparison over the last few complete months
  const cutoff = month < current ? month : current
  const usualMonths = history.months.filter((m) => m < cutoff).slice(-3)
  const usual = usualMonths.length
    ? shareRows(amountsOver(expenses, usualMonths), categories, category.id).rows.find(
        (r) => r.category.id === category.id,
      )
    : undefined

  const focus = rows.find((r) => r.category.id === category.id)
  const shown = rows.slice(0, SHARE_ROWS)
  if (focus && !shown.includes(focus)) shown.push(focus)
  const hiddenCount = rows.length - shown.length
  const maxShare = rows[0]?.share ?? 1

  const title = isFuture ? t('category.shareOfPlan') : t('category.shareOfSpending')

  if (rows.length === 0) {
    return (
      <Pane title={title}>
        <Empty>
          {isFuture
            ? t('category.noLimits')
            : t(month === current ? 'category.nothingSpentYet' : 'category.nothingSpent', {
                month: formatMonthName(month),
              })}
        </Empty>
      </Pane>
    )
  }

  return (
    <Pane title={title}>
      <p className="text-[15px] leading-snug text-white">
        {focus ? (
          <Trans
            k={isFuture ? 'category.shareOfPlanLine' : 'category.shareOfSpendingLine'}
            values={{ percent: percent(focus.share), month: formatMonthName(month) }}
            tags={{ b: (s) => <strong className="font-semibold">{s}</strong> }}
          />
        ) : (
          t(isFuture ? 'category.nothingPlannedIn' : 'category.nothingSpentIn', {
            name: category.name,
            month: formatMonthName(month),
          })
        )}
        {usual && (
          <span className="text-slate-300">
            {' '}
            {t('category.usually', { percent: percent(usual.share) })}
          </span>
        )}
      </p>

      <ul className="mt-3 grid gap-0.5">
        {shown.map((r) => {
          const isFocus = r.category.id === category.id
          const row = (
            <>
              <span
                className={`min-w-0 truncate text-sm ${isFocus ? 'font-semibold text-white' : 'text-slate-300'}`}
              >
                {r.category.name}
              </span>
              <span className="flex h-2 items-center">
                <span
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max((r.share / maxShare) * 100, 2)}%`,
                    backgroundColor: isFocus ? CHART.accent : CHART.deemphasis,
                  }}
                />
              </span>
              <span className="w-24 text-right text-sm tabular-nums">
                <span className={isFocus ? 'font-semibold text-white' : 'text-slate-200'}>
                  {percent(r.share)}
                </span>{' '}
                <span className="text-xs text-muted">{formatAmount(Math.round(r.amount))}</span>
              </span>
            </>
          )
          const cls =
            'grid w-full grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left'
          return (
            <li key={r.category.id}>
              {onSelect && !isFocus ? (
                <button
                  type="button"
                  onClick={() => onSelect(r.category.id)}
                  className={`${cls} transition hover:bg-white/5 active:bg-white/10`}
                >
                  {row}
                </button>
              ) : (
                <div className={`${cls} ${isFocus ? 'bg-white/5' : ''}`}>{row}</div>
              )}
            </li>
          )
        })}
      </ul>
      {(hiddenCount > 0 || leftOut.length > 0) && (
        <p className="mt-2 px-2 text-xs text-muted">
          {hiddenCount > 0 && `${t('category.hiddenSmaller', { count: hiddenCount })} `}
          {leftOut.length > 0 &&
            t('category.leftOut', { names: leftOut.map((c) => c.name).join(', ') })}
        </p>
      )}
    </Pane>
  )
}

function percent(share: number): string {
  const p = share * 100
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

/* ---------- bits ---------- */

function Pane({
  title,
  aside,
  className = '',
  scroll = true,
  children,
}: {
  title: string
  aside?: string
  className?: string
  /** Scroll the whole body inside the pane on a laptop; off when the pane scrolls a part itself. */
  scroll?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-3xl p-4 ring-1 ring-white/10 lg:p-5 ${className}`}
      style={{ backgroundColor: CHART.surface }}
    >
      <header className="mb-3 flex shrink-0 items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </header>
      <div className={`flex min-h-0 flex-1 flex-col ${scroll ? 'lg:overflow-y-auto' : ''}`}>
        {children}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'warning'
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted">{label}</p>
      <p
        className="truncate text-lg font-bold tabular-nums text-white"
        style={tone === 'warning' ? { color: CHART.warning } : undefined}
      >
        {value}
      </p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{children}</p>
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
      <div className="h-96 animate-pulse rounded-3xl bg-white/5 lg:row-span-2 lg:h-auto" />
      <div className="h-80 animate-pulse rounded-3xl bg-white/5" />
      <div className="h-64 animate-pulse rounded-3xl bg-white/5 lg:h-auto" />
    </div>
  )
}
