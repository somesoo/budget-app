import { CaretRight, WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useMonthCategories } from '../../hooks/useBudgets'
import { useMonthlyExpenses } from '../../hooks/useExpenses'
import { useIncomesBetween } from '../../hooks/useIncomes'
import {
  formatMoneyWhole,
  formatMonthName,
  monthRange,
  type MonthKey,
} from '../../lib/calculations'
import { monthReview } from '../../lib/suggestions'

/** Rows of each list shown; the category bars below have the rest. */
const ROWS = 3

/**
 * How last month went against its plan, shown for the first days of a new
 * month: what went over (worth a different limit this time), what was left
 * (worth moving to savings), and what was saved.
 */
export function MonthReviewCard({
  month,
  onPlan,
  onOpen,
}: {
  /** The month that just ended. */
  month: MonthKey
  /** Plan the running month; absent once it has a plan. */
  onPlan?: () => void
  onOpen: () => void
}) {
  const { data: categories, plan } = useMonthCategories(month)
  const { data: expenses } = useMonthlyExpenses(month)
  const { from, to } = monthRange(month)
  const { data: incomes } = useIncomesBetween(from, to)
  if (!categories || !expenses || !incomes || expenses.length === 0) return null

  const r = monthReview({
    month,
    expenses,
    categories,
    income: incomes.reduce((a, i) => a + i.amount, 0),
    plannedSavings: plan ? plan.savings : null,
  })
  const name = formatMonthName(month)
  const diff = r.spent - r.limit

  return (
    <section
      className="mb-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10"
      aria-labelledby="review"
    >
      <h2 id="review" className="text-base font-semibold text-white">
        How {name} went
      </h2>
      <p className="mt-1 text-sm leading-snug text-slate-300">
        {r.limit > 0
          ? `Spent ${formatMoneyWhole(r.spent)} of ${formatMoneyWhole(r.limit)}, ${formatMoneyWhole(Math.abs(diff))} ${
              diff > 0 ? 'over' : 'under'
            }. `
          : `Spent ${formatMoneyWhole(r.spent)}. `}
        {r.income > 0 &&
          `${r.saved >= 0 ? 'Left over' : 'Short by'} ${formatMoneyWhole(Math.abs(r.saved))}${
            r.plannedSavings
              ? `, against ${formatMoneyWhole(r.plannedSavings)} planned for savings`
              : ''
          }.`}
      </p>

      {r.over.length > 0 && (
        <ReviewList
          title="Went over"
          month={month}
          rows={r.over.slice(0, ROWS).map((x) => ({
            id: x.category.id,
            name: x.category.name,
            text: `${formatMoneyWhole(x.spent - x.limit)} over ${formatMoneyWhole(x.limit)}`,
            warn: true,
          }))}
        />
      )}
      {r.under.length > 0 && (
        <ReviewList
          title="Left room"
          month={month}
          rows={r.under.slice(0, ROWS).map((x) => ({
            id: x.category.id,
            name: x.category.name,
            text: `${formatMoneyWhole(x.limit - x.spent)} of ${formatMoneyWhole(x.limit)} unused`,
            warn: false,
          }))}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {onPlan && (
          <button
            type="button"
            onClick={onPlan}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-ink hover:bg-slate-50"
          >
            Plan this month with it
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
        >
          See all of {name}
        </button>
      </div>
    </section>
  )
}

function ReviewList({
  title,
  month,
  rows,
}: {
  title: string
  month: MonthKey
  rows: { id: string; name: string; text: string; warn: boolean }[]
}) {
  return (
    <div className="mt-3">
      <h3 className="text-sm text-muted">{title}</h3>
      <ul className="mt-1 grid gap-0.5">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to={`/category/${row.id}?month=${month}`}
              className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/5"
            >
              {row.warn && (
                <WarningCircle weight="fill" aria-hidden className="shrink-0 text-red-300" />
              )}
              <span className="font-medium text-white">{row.name}</span>
              <span className="min-w-0 flex-1 truncate text-slate-300">{row.text}</span>
              <CaretRight aria-hidden className="shrink-0 text-muted group-hover:text-white" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
