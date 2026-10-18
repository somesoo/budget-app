import { ArrowLeft } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CategoryDeltaBars } from '../components/charts/CategoryDeltaBars'
import { ChartCard, LegendItem, TooltipRow } from '../components/charts/ChartCard'
import { ColumnChart } from '../components/charts/ColumnChart'
import { PairColumns } from '../components/charts/PairColumns'
import { SpendDonut } from '../components/charts/SpendDonut'
import { CHART } from '../components/charts/theme'
import { spanDates, spanName } from '../components/settings/ChaptersCard'
import { sharePercent } from '../components/TopCategoriesList'
import { CURRENCY_SUFFIX, WEEKDAY_EXCLUDE_FROM } from '../config'
import { useCategories } from '../hooks/useCategories'
import { useChapters } from '../hooks/useChapters'
import { useExpensesBetween } from '../hooks/useExpenses'
import { useIncomesBetween } from '../hooks/useIncomes'
import {
  formatAmount,
  formatDayShort,
  formatMoney,
  formatMoneyWhole,
  formatMonthName,
  formatMonthShort,
  roundMoney,
  sumByCategory,
  todayKey,
  weekdayNames,
} from '../lib/calculations'
import { EARLIER_ID, chapterSpans, summarizeChapter, type ChapterSummary } from '../lib/chapters'
import { categorySlices, weekdayAverages, type CategoryDelta } from '../lib/insights'
import type { Category, Expense } from '../types'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'

/** Before anything anyone could have logged: a chapter with no start reaches back to here. */
const BEGINNING = '2000-01-01'

/**
 * What a chapter came to, start to finish: money in and out, month by month
 * and year by year, where it went, what changed, the biggest buys. Reads the
 * chapter whole, whatever this phone hides elsewhere.
 */
export function ChapterPage() {
  const { id = '' } = useParams()
  const { data } = useChapters()
  const { data: categories = [] } = useCategories()
  const spans = data ? chapterSpans(data.chapters) : []
  const span = spans.find((s) => (s.id ?? EARLIER_ID) === id)
  const from = span?.from ?? BEGINNING
  const to = span?.to ?? todayKey()
  const expenses = useExpensesBetween(from, to, 'all')
  const incomes = useIncomesBetween(from, to, false, 'all')

  if (data && !span) return <Navigate to="/settings" replace />

  const loading = !data || !expenses.data || !incomes.data
  const summary =
    expenses.data && incomes.data
      ? summarizeChapter({ expenses: expenses.data, incomes: incomes.data })
      : null

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] lg:max-w-6xl lg:px-8 lg:pb-12 lg:pt-8">
      <Header
        title={span ? spanName(span, spans) : t('chapters.title')}
        subtitle={span ? spanDates(span) : undefined}
      />
      {expenses.error || incomes.error ? (
        <p className="rounded-3xl bg-white/5 p-5 text-center text-sm text-muted ring-1 ring-white/10">
          {t('chapters.loadFailed', {
            error: ((expenses.error ?? incomes.error) as Error).message,
          })}
        </p>
      ) : loading || !summary ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/5" />
          ))}
        </div>
      ) : summary.months.length === 0 ? (
        <p className="rounded-3xl bg-white/5 p-5 text-center text-sm text-muted ring-1 ring-white/10">
          {t('chapters.empty')}
        </p>
      ) : (
        <Body summary={summary} expenses={expenses.data!} categories={categories} />
      )}
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate()
  return (
    <header className="mb-5 flex items-center gap-3">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/settings'))}
        aria-label={t('common.back')}
        className="-ml-2 rounded-full p-2 text-2xl text-muted hover:bg-white/5"
      >
        <ArrowLeft />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft">
          {t('chapters.eyebrow')}
        </p>
        <h1 className="truncate text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
    </header>
  )
}

function Body({
  summary,
  expenses,
  categories,
}: {
  summary: ChapterSummary
  expenses: Expense[]
  categories: Category[]
}) {
  return (
    <div className="space-y-4">
      <Totals summary={summary} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <MonthsCard summary={summary} />
          <InOutCard summary={summary} />
          <YearsCard summary={summary} />
          <WeekdayCard expenses={expenses} summary={summary} />
        </div>
        <div className="space-y-4">
          <WhereCard expenses={expenses} categories={categories} />
          <ChangeCard expenses={expenses} categories={categories} summary={summary} />
          <BiggestCard summary={summary} categories={categories} />
        </div>
      </div>
    </div>
  )
}

/* ---------- the totals ---------- */

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{value}</p>
      {note && <p className="mt-0.5 text-xs leading-snug text-muted">{note}</p>}
    </div>
  )
}

function Totals({ summary: s }: { summary: ChapterSummary }) {
  const months = s.months.length
  return (
    <section>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile
          label={t('chapters.spent')}
          value={formatMoneyWhole(s.spent)}
          note={t('chapters.overMonths', { count: months })}
        />
        <Tile
          label={t('chapters.income')}
          value={s.incomeMonths > 0 ? formatMoneyWhole(s.income) : '—'}
          note={
            s.incomeMonths > 0
              ? t('chapters.overMonths', { count: s.incomeMonths })
              : t('chapters.noIncome')
          }
        />
        <Tile
          label={s.saved >= 0 ? t('chapters.saved') : t('chapters.shortBy')}
          value={s.incomeMonths > 0 ? formatMoneyWhole(Math.abs(s.saved)) : '—'}
          note={
            s.savingsRate !== null
              ? t('chapters.savingsRate', { percent: Math.round(s.savingsRate * 100) })
              : undefined
          }
        />
        <Tile
          label={t('chapters.perMonth')}
          value={formatMoneyWhole(s.averageSpent)}
          note={
            s.averageIncome !== null
              ? t('chapters.incomePerMonth', { amount: formatMoneyWhole(s.averageIncome) })
              : undefined
          }
        />
      </div>
      <p className="mt-2 text-xs leading-snug text-muted">
        {t('chapters.counted', {
          count: s.expenseCount,
          formatted: formatAmount(s.expenseCount),
          months,
        })}
        {s.incomeMonths > 0 && s.incomeMonths < months
          ? ` ${t('chapters.incomePartial', { count: s.incomeMonths, months })}`
          : ''}
      </p>
    </section>
  )
}

/* ---------- month by month ---------- */

function MonthsCard({ summary: s }: { summary: ChapterSummary }) {
  const top = s.biggestMonth!
  return (
    <ChartCard
      title={t('chapters.monthsTitle')}
      headline={
        <Trans
          k="chapters.monthsHeadline"
          values={{
            average: formatMoneyWhole(s.averageSpent),
            month: formatMonthName(top.month),
            year: top.month.slice(0, 4),
            amount: formatMoneyWhole(top.spent),
          }}
          tags={{ b: (x) => <strong>{x}</strong> }}
        />
      }
      legend={<LegendItem color={CHART.textMuted} label={t('chapters.average')} shape="dashed" />}
      table={{
        head: [t('insights.month'), t('common.spent')],
        rows: s.months.map((m) => [monthLabel(m.month), formatAmount(m.spent)]),
      }}
    >
      <ColumnChart
        ariaLabel={t('chapters.monthsTitle')}
        emphasize={top.month}
        reference={{ value: s.averageSpent, label: t('chapters.average') }}
        columns={s.months.map((m) => ({
          key: m.month,
          label: formatMonthShort(m.month),
          value: m.spent,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{monthLabel(m.month)}</p>
              <TooltipRow label={t('common.spent')} value={formatMoney(m.spent)} />
              <TooltipRow label={t('chapters.average')} value={formatMoneyWhole(s.averageSpent)} />
            </>
          ),
        }))}
      />
    </ChartCard>
  )
}

const monthLabel = (month: string) => `${formatMonthName(month)} ${month.slice(0, 4)}`

/* ---------- money in and out ---------- */

function InOutCard({ summary: s }: { summary: ChapterSummary }) {
  const months = s.months.filter((m) => m.income !== null)
  if (months.length === 0) return null
  const plus = months.filter((m) => m.income! >= m.spent).length
  return (
    <ChartCard
      title={t('chapters.inOutTitle')}
      headline={
        <Trans
          k="chapters.inOutHeadline"
          values={{ plus, count: months.length }}
          tags={{ b: (x) => <strong>{x}</strong> }}
        />
      }
      legend={
        <div className="flex flex-wrap gap-3">
          <LegendItem color={CHART.deemphasis} label={t('chapters.income')} shape="rect" />
          <LegendItem color={CHART.accent} label={t('chapters.spent')} shape="rect" />
        </div>
      }
      table={{
        head: [t('insights.month'), t('chapters.income'), t('common.spent'), t('chapters.left')],
        rows: months.map((m) => [
          monthLabel(m.month),
          formatAmount(m.income!),
          formatAmount(m.spent),
          formatAmount(roundMoney(m.income! - m.spent)),
        ]),
      }}
    >
      <PairColumns
        ariaLabel={t('chapters.inOutTitle')}
        pairs={months.map((m) => ({
          key: m.month,
          label: formatMonthShort(m.month),
          context: m.income!,
          value: m.spent,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{monthLabel(m.month)}</p>
              <TooltipRow color={CHART.deemphasis} label={t('chapters.income')} value={formatMoney(m.income!)} />
              <TooltipRow color={CHART.accent} label={t('common.spent')} value={formatMoney(m.spent)} />
              <TooltipRow
                label={t('chapters.left')}
                value={formatMoney(roundMoney(m.income! - m.spent))}
              />
            </>
          ),
        }))}
      />
    </ChartCard>
  )
}

/* ---------- year by year ---------- */

function YearsCard({ summary: s }: { summary: ChapterSummary }) {
  if (s.years.length < 2) return null
  const rows = s.years.map((y) => ({ ...y, average: roundMoney(y.spent / Math.max(y.months, 1)) }))
  const first = rows[0]
  const last = rows[rows.length - 1]
  const change = first.average > 0 ? (last.average - first.average) / first.average : null
  return (
    <ChartCard
      title={t('chapters.yearsTitle')}
      headline={
        change !== null ? (
          <Trans
            k={change >= 0 ? 'chapters.yearsUp' : 'chapters.yearsDown'}
            values={{
              first: first.label,
              last: last.label,
              percent: Math.abs(Math.round(change * 100)),
            }}
            tags={{ b: (x) => <strong>{x}</strong> }}
          />
        ) : undefined
      }
      table={{
        head: [t('chapters.year'), t('common.spent'), t('chapters.monthsCol'), t('chapters.perMonth')],
        rows: rows.map((y) => [y.label, formatAmount(y.spent), y.months, formatAmount(y.average)]),
      }}
    >
      <ColumnChart
        ariaLabel={t('chapters.yearsTitle')}
        emphasize={last.label}
        columns={rows.map((y) => ({
          key: y.label,
          label: y.label,
          value: y.average,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">
                {y.label} · {t('chapters.overMonths', { count: y.months })}
              </p>
              <TooltipRow label={t('chapters.perMonth')} value={formatMoneyWhole(y.average)} />
              <TooltipRow label={t('chapters.inYear')} value={formatMoneyWhole(y.spent)} />
            </>
          ),
        }))}
      />
      <p className="mt-1 text-xs text-muted">{t('chapters.yearsNote')}</p>
    </ChartCard>
  )
}

/* ---------- where it went ---------- */

function WhereCard({ expenses, categories }: { expenses: Expense[]; categories: Category[] }) {
  const slices = categorySlices(expenses, categories, 7)
  if (slices.length === 0) return null
  const byCategory = sumByCategory(expenses)
  const leftOut = categories.filter((c) => !c.show_in_chart && (byCategory[c.id] ?? 0) > 0)
  return (
    <ChartCard
      title={t('chapters.whereTitle')}
      headline={
        <Trans
          k="chapters.whereHeadline"
          values={{ name: slices[0].name, share: sharePercent(slices[0].share) }}
          tags={{ b: (x) => <strong>{x}</strong> }}
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
            list: leftOut.map((c) => `${c.name} ${formatMoneyWhole(byCategory[c.id])}`).join(' · '),
          })}
        </p>
      )}
    </ChartCard>
  )
}

/* ---------- what changed, first year to last ---------- */

function ChangeCard({
  expenses,
  categories,
  summary: s,
}: {
  expenses: Expense[]
  categories: Category[]
  summary: ChapterSummary
}) {
  if (s.years.length < 2) return null
  const first = s.years[0]
  const last = s.years[s.years.length - 1]
  const perMonth = (from: string, to: string, months: number) => {
    const sums = sumByCategory(
      expenses.filter((e) => e.expense_date.slice(0, 7) >= from && e.expense_date.slice(0, 7) <= to),
    )
    return (id: string) => roundMoney((sums[id] ?? 0) / Math.max(months, 1))
  }
  const before = perMonth(first.from, first.to, first.months)
  const after = perMonth(last.from, last.to, last.months)
  const deltas: CategoryDelta[] = categories
    .map((category) => {
      const current = after(category.id)
      const previous = before(category.id)
      return { category, current, previous, delta: roundMoney(current - previous) }
    })
    .filter((d) => d.current > 0 || d.previous > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8)
  if (deltas.length === 0) return null
  const top = deltas[0]
  return (
    <ChartCard
      title={t('chapters.changeTitle')}
      headline={
        <Trans
          k={top.delta >= 0 ? 'chapters.changeUp' : 'chapters.changeDown'}
          values={{
            name: top.category.name,
            amount: formatMoneyWhole(Math.abs(top.delta)),
            first: first.label,
            last: last.label,
          }}
          tags={{ b: (x) => <strong>{x}</strong> }}
        />
      }
      table={{
        head: [t('entry.category'), first.label, last.label],
        rows: deltas.map((d) => [d.category.name, formatAmount(d.previous), formatAmount(d.current)]),
      }}
    >
      <CategoryDeltaBars deltas={deltas} currentLabel={last.label} previousLabel={first.label} />
      <p className="mt-1 text-xs text-muted">{t('chapters.changeNote')}</p>
    </ChartCard>
  )
}

/* ---------- the biggest buys ---------- */

function BiggestCard({ summary: s, categories }: { summary: ChapterSummary; categories: Category[] }) {
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? ''
  return (
    <Card title={t('chapters.biggestTitle')}>
      <ol className="divide-y divide-white/5">
        {s.biggest.map((e, i) => (
          <li key={e.id} className="flex items-center gap-3 py-2">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-white">{e.note || name(e.categoryId)}</span>
              <span className="block truncate text-xs text-muted">
                {name(e.categoryId)} · {formatDayShort(e.date)} {e.date.slice(0, 4)}
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-white">
              {formatMoneyWhole(e.amount)}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ---------- weekdays ---------- */

function WeekdayCard({ expenses, summary: s }: { expenses: Expense[]; summary: ChapterSummary }) {
  // everyday habits: rent and other big one-offs would crown whichever day they fell on
  const everyday = expenses.filter((e) => e.amount < WEEKDAY_EXCLUDE_FROM)
  const averages = weekdayAverages(
    everyday,
    s.months.map((m) => m.month),
  )
  const top = averages.reduce((a, b) => (b.average > a.average ? b : a))
  if (top.average <= 0) return null
  const shortNames = weekdayNames('short')
  const longNames = weekdayNames('long')
  return (
    <ChartCard
      title={t('insights.weekdayTitle')}
      headline={
        <Trans
          k="insights.priciestDay"
          values={{ day: longNames[top.weekday], amount: formatMoneyWhole(top.average) }}
          tags={{ b: (x) => <strong>{x}</strong> }}
        />
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
        {t('chapters.weekdayNote', { amount: `${formatAmount(WEEKDAY_EXCLUDE_FROM)} ${CURRENCY_SUFFIX}` })}
      </p>
    </ChartCard>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl p-4 ring-1 ring-white/10" style={{ backgroundColor: CHART.surface }}>
      <h2 className="mb-2 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

