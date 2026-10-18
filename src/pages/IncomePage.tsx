import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { IncomePad } from '../components/IncomePad'
import { ChartCard, LegendItem, TooltipRow } from '../components/charts/ChartCard'
import { ColumnChart } from '../components/charts/ColumnChart'
import { PersonLines } from '../components/charts/PersonLines'
import { CHART } from '../components/charts/theme'
import { EntryDialogs } from '../components/history/EntryDialogs'
import { EntryRow } from '../components/history/EntryRow'
import { Segments } from '../components/savings/fields'
import { Screen } from '../components/Screen'
import { useCategories } from '../hooks/useCategories'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useEntryActions } from '../hooks/useEntryActions'
import { useAddIncome, useIncomesBetween } from '../hooks/useIncomes'
import {
  categoryById,
  currentMonthKey,
  formatAmount,
  formatMoney,
  formatMoneyWhole,
  formatMonthName,
  formatMonthShort,
  incomeMonth,
  monthRange,
  roundMoney,
  shiftMonth,
  type MonthKey,
} from '../lib/calculations'
import { toEntries } from '../lib/history'
import {
  firstIncomeMonth,
  incomeByMonth,
  incomeTrend,
  payByYear,
  type IncomeMonth,
  type IncomeTrend,
} from '../lib/income'
import { personColor, personIds, personLabel } from '../lib/people'
import type { Income, Person } from '../types'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'

type Range = '12' | '24' | 'all'

/** Before anything anyone could have logged: "all" reaches back to here. */
const BEGINNING: MonthKey = '2000-01'

/**
 * Money in, over time: pay month by month and whether it's going up, who
 * brings it in, year by year, and every income logged, to add to, correct
 * and delete (with an undo) right here.
 */
export function IncomePage() {
  const [range, setRange] = useState<Range>('24')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { person: me } = useDeviceUser()
  const [entryPerson, setEntryPerson] = useState<Person>(me ?? personIds()[0])
  const addIncome = useAddIncome()
  const actions = useEntryActions()
  const { data: categories = [] } = useCategories()

  const now = currentMonthKey()
  const rangeFrom = range === 'all' ? BEGINNING : shiftMonth(now, -(Number(range) - 1))
  // the trend compares a year with the one before, whatever the range shows
  const fetchFrom = range === 'all' ? BEGINNING : shiftMonth(now, -23)
  // pay that arrives late in the month can be for the month after
  const fetchTo = shiftMonth(now, 1)
  const query = useIncomesBetween(monthRange(fetchFrom).from, monthRange(fetchTo).to)
  const incomes = query.data

  if (adding) {
    return (
      <IncomePad
        person={entryPerson}
        onPersonChange={setEntryPerson}
        onCancel={() => setAdding(false)}
        saving={addIncome.isPending}
        onSave={({ amount, person, note, date, forMonth, oneOff }) => {
          setError(null)
          addIncome.mutate(
            { amount, person, note, income_date: date, for_month: forMonth, one_off: oneOff },
            { onError: (err) => setError(t('entry.notSaved', { error: (err as Error).message })) },
          )
          setAdding(false)
        }}
      />
    )
  }

  return (
    <Screen
      title={t('incomePage.title')}
      wide
      action={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-ink active:scale-[0.97]"
        >
          <Plus weight="bold" aria-hidden /> {t('incomePage.add')}
        </button>
      }
    >
      <div className="mb-4 max-w-sm">
        <Segments
          value={range}
          onChange={setRange}
          options={[
            { value: '12', label: t('incomePage.range12') },
            { value: '24', label: t('incomePage.range24') },
            { value: 'all', label: t('incomePage.rangeAll') },
          ]}
        />
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {query.error ? (
        <p className="rounded-3xl bg-white/5 p-5 text-center text-sm text-muted ring-1 ring-white/10">
          {t('incomePage.loadFailed', { error: (query.error as Error).message })}
        </p>
      ) : !incomes ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/5" />
          ))}
        </div>
      ) : incomes.length === 0 ? (
        <p className="rounded-3xl bg-white/5 p-5 text-center text-sm text-muted ring-1 ring-white/10">
          {t('incomePage.empty')}
        </p>
      ) : (
        <Body
          incomes={incomes}
          rangeFrom={range === 'all' ? (firstIncomeMonth(incomes) ?? now) : rangeFrom}
          now={now}
          onOpen={(income) =>
            actions.edit({
              kind: 'income',
              id: income.id,
              date: income.income_date,
              createdAt: income.created_at,
              item: income,
            })
          }
        />
      )}
      <EntryDialogs actions={actions} categories={categories} />
    </Screen>
  )
}

function Body({
  incomes,
  rangeFrom,
  now,
  onOpen,
}: {
  incomes: Income[]
  rangeFrom: MonthKey
  now: MonthKey
  onOpen: (income: Income) => void
}) {
  // up to the last month anything is logged for (pay for next month counts)
  const last = incomes.reduce((max, i) => (incomeMonth(i) > max ? incomeMonth(i) : max), now)
  const all = incomeByMonth(incomes, shiftMonth(now, -23) < rangeFrom ? shiftMonth(now, -23) : rangeFrom, last)
  // the trend always looks at the last two years up to this month
  const trend = incomeTrend(all.filter((r) => r.month <= now))
  const rows = all.filter((r) => r.month >= rangeFrom)
  const shown = incomes.filter((i) => incomeMonth(i) >= rangeFrom)

  return (
    <div className="space-y-4">
      <Tiles trend={trend} rows={rows} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <MonthsCard rows={rows} trend={trend} />
          <PeopleCard rows={rows} />
          <YearsCard rows={rows} />
        </div>
        <ListCard incomes={shown} onOpen={onOpen} />
      </div>
    </div>
  )
}

/* ---------- the totals ---------- */

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-0.5 text-xl font-semibold tabular-nums ${
          tone === 'up' ? 'text-positive' : tone === 'down' ? 'text-amber-200' : 'text-white'
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs leading-snug text-muted">{note}</p>}
    </div>
  )
}

function Tiles({ trend, rows }: { trend: IncomeTrend; rows: IncomeMonth[] }) {
  const total = roundMoney(rows.reduce((s, r) => s + r.pay + r.oneOff, 0))
  const oneOffs = roundMoney(rows.reduce((s, r) => s + r.oneOff, 0))
  const best = rows.reduce<IncomeMonth | null>(
    (top, r) => (r.pay > 0 && (top === null || r.pay > top.pay) ? r : top),
    null,
  )
  const change = trend.change
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Tile
        label={t('incomePage.averagePay')}
        value={trend.recent !== null ? formatMoneyWhole(trend.recent) : '—'}
        note={t('incomePage.last12')}
      />
      <Tile
        label={t('incomePage.yearOnYear')}
        value={
          change === null ? '—' : `${change >= 0 ? '+' : '−'}${Math.abs(Math.round(change * 100))}%`
        }
        tone={change === null ? undefined : change >= 0 ? 'up' : 'down'}
        note={
          trend.before !== null
            ? t('incomePage.versus', { amount: formatMoneyWhole(trend.before) })
            : t('incomePage.noYearBefore')
        }
      />
      <Tile
        label={t('incomePage.total')}
        value={formatMoneyWhole(total)}
        note={oneOffs > 0 ? t('incomePage.withOneOffs', { amount: formatMoneyWhole(oneOffs) }) : undefined}
      />
      <Tile
        label={t('incomePage.best')}
        value={best ? formatMoneyWhole(best.pay) : '—'}
        note={best ? monthLabel(best.month) : undefined}
      />
    </div>
  )
}

const monthLabel = (month: string) => `${formatMonthName(month)} ${month.slice(0, 4)}`

/* ---------- month by month ---------- */

function MonthsCard({ rows, trend }: { rows: IncomeMonth[]; trend: IncomeTrend }) {
  if (rows.length < 2) return null
  const paid = rows.filter((r) => r.pay > 0)
  const average = paid.length ? roundMoney(paid.reduce((s, r) => s + r.pay, 0) / paid.length) : 0
  const lastPaid = paid.at(-1)
  return (
    <ChartCard
      title={t('incomePage.monthsTitle')}
      headline={
        trend.change !== null ? (
          <Trans
            k={trend.change >= 0 ? 'incomePage.trendUp' : 'incomePage.trendDown'}
            values={{
              percent: Math.abs(Math.round(trend.change * 100)),
              recent: formatMoneyWhole(trend.recent!),
              before: formatMoneyWhole(trend.before!),
            }}
            tags={{ b: (x) => <strong>{x}</strong> }}
          />
        ) : (
          t('incomePage.trendNone')
        )
      }
      legend={
        <div className="flex flex-wrap gap-3">
          <LegendItem color={CHART.textMuted} label={t('incomePage.averageLine')} shape="dashed" />
        </div>
      }
      table={{
        head: [t('insights.month'), t('incomePage.pay'), t('incomePage.oneOff')],
        rows: rows.map((r) => [monthLabel(r.month), formatAmount(r.pay), formatAmount(r.oneOff)]),
      }}
    >
      <ColumnChart
        ariaLabel={t('incomePage.monthsTitle')}
        emphasize={lastPaid?.month}
        reference={average > 0 ? { value: average, label: t('incomePage.averageLine') } : undefined}
        columns={rows.map((r) => ({
          key: r.month,
          label: formatMonthShort(r.month),
          value: r.pay,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{monthLabel(r.month)}</p>
              <TooltipRow label={t('incomePage.pay')} value={formatMoney(r.pay)} />
              {r.oneOff > 0 && <TooltipRow label={t('incomePage.oneOff')} value={formatMoney(r.oneOff)} />}
              {Object.entries(r.byPerson).length > 1 &&
                Object.entries(r.byPerson).map(([p, v]) => (
                  <TooltipRow key={p} color={personColor(p)} label={personLabel(p)} value={formatMoney(v)} />
                ))}
            </>
          ),
        }))}
      />
      <p className="mt-1 text-xs text-muted">{t('incomePage.monthsNote')}</p>
    </ChartCard>
  )
}

/* ---------- who brings it in ---------- */

function PeopleCard({ rows }: { rows: IncomeMonth[] }) {
  const earners = personIds().filter((p) => rows.some((r) => (r.byPerson[p] ?? 0) > 0))
  if (earners.length < 2 || rows.length < 2) return null
  const totals = earners.map((p) => ({
    person: p,
    total: roundMoney(rows.reduce((s, r) => s + (r.byPerson[p] ?? 0), 0)),
  }))
  const sum = totals.reduce((s, x) => s + x.total, 0)
  return (
    <ChartCard
      title={t('incomePage.peopleTitle')}
      legend={
        <div className="flex flex-wrap gap-3">
          {totals.map((x) => (
            <LegendItem
              key={x.person}
              color={personColor(x.person)}
              label={`${personLabel(x.person)} · ${sum > 0 ? Math.round((x.total / sum) * 100) : 0}%`}
              shape="line"
            />
          ))}
        </div>
      }
      table={{
        head: [t('insights.month'), ...earners.map(personLabel)],
        rows: rows.map((r) => [monthLabel(r.month), ...earners.map((p) => formatAmount(r.byPerson[p] ?? 0))]),
      }}
    >
      <PersonLines
        rows={rows.map((r) => ({ month: r.month, by: r.byPerson }))}
        monthLabel={formatMonthShort}
      />
    </ChartCard>
  )
}

/* ---------- year by year ---------- */

function YearsCard({ rows }: { rows: IncomeMonth[] }) {
  const years = payByYear(rows)
  if (years.length < 2) return null
  const last = years[years.length - 1]
  return (
    <ChartCard
      title={t('incomePage.yearsTitle')}
      table={{
        head: [t('chapters.year'), t('incomePage.averagePay'), t('chapters.monthsCol'), t('incomePage.total')],
        rows: years.map((y) => [y.year, formatAmount(y.average), y.months, formatAmount(y.total)]),
      }}
    >
      <ColumnChart
        ariaLabel={t('incomePage.yearsTitle')}
        emphasize={last.year}
        columns={years.map((y) => ({
          key: y.year,
          label: y.year,
          value: y.average,
          tooltip: (
            <>
              <p className="mb-1 text-slate-400">{y.year}</p>
              <TooltipRow label={t('incomePage.averagePay')} value={formatMoneyWhole(y.average)} />
              <TooltipRow label={t('chapters.monthsCol')} value={String(y.months)} />
            </>
          ),
        }))}
      />
      <p className="mt-1 text-xs text-muted">{t('incomePage.yearsNote')}</p>
    </ChartCard>
  )
}

/* ---------- every income ---------- */

function ListCard({ incomes, onOpen }: { incomes: Income[]; onOpen: (income: Income) => void }) {
  const entries = toEntries([], incomes)
  const byMonth = new Map<MonthKey, typeof entries>()
  for (const e of entries) {
    if (e.kind !== 'income') continue
    const m = incomeMonth(e.item)
    byMonth.set(m, [...(byMonth.get(m) ?? []), e])
  }
  const months = [...byMonth.keys()].sort().reverse()
  const categories = categoryById([])
  return (
    <section className="rounded-3xl p-4 ring-1 ring-white/10" style={{ backgroundColor: CHART.surface }}>
      <h2 className="text-base font-semibold text-white">{t('incomePage.listTitle')}</h2>
      <p className="mt-0.5 text-xs text-muted">{t('incomePage.listHelp')}</p>
      <div className="mt-3 space-y-4">
        {months.map((m) => {
          const list = byMonth.get(m)!
          const sum = roundMoney(list.reduce((s, e) => s + e.item.amount, 0))
          return (
            <div key={m}>
              <div className="mb-1 flex items-baseline justify-between gap-2 border-b border-white/5 pb-1">
                <h3 className="text-sm font-semibold text-slate-200">{monthLabel(m)}</h3>
                <span className="text-sm font-semibold tabular-nums text-positive">
                  +{formatMoneyWhole(sum)}
                </span>
              </div>
              <ul>
                {list.map((e) => (
                  <li key={e.id}>
                    <EntryRow
                      entry={e}
                      categories={categories}
                      onOpen={e.kind === 'income' ? () => onOpen(e.item) : undefined}
                      dense
                      showDate
                    />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
