import type { Category, Expense } from '../types'
import { currentMonthKey, monthKeyOfDate, roundMoney, shiftMonth, type MonthKey } from './calculations'
import { monthsEndingAt, trimLeadingEmpty } from './insights'

/*
 * One category up close: what it cost month by month, and how big a piece of
 * the whole it is. Arithmetic over logged expenses, like the rest of lib/.
 */

/** How many months the category view looks back over: a year, so last year's same month is there. */
export const DETAIL_MONTHS = 12
/** "Typical" is the average of this many most recent complete months, as in the planner. */
const TYPICAL_OVER = 3

/**
 * The months the view covers for `month`. A month still to come has no
 * spending of its own, so the window ends at the running month instead.
 */
export function detailWindow(month: MonthKey): MonthKey[] {
  const current = currentMonthKey()
  return monthsEndingAt(month > current ? current : month, DETAIL_MONTHS)
}

export interface CategoryHistory {
  /** Months with data, oldest first. The months before the first logged expense are left out. */
  months: MonthKey[]
  /** This category's spending per month, aligned with `months`. */
  totals: number[]
  /** Average of the last few complete months before the one in focus, or null with none. */
  typical: number | null
  /** The complete month just before the one in focus. */
  previous: { month: MonthKey; total: number } | null
  /** The same calendar month a year earlier, when the window reaches it. */
  sameMonthLastYear: number | null
  /** Most expensive month in the window. */
  peak: { month: MonthKey; total: number } | null
  /** This category's expenses in the window, newest first. */
  expenses: Expense[]
}

/** `expenses` covers every category, so months are trimmed on all spending, not just this one. */
export function categoryHistory(
  expenses: Expense[],
  categoryId: string,
  month: MonthKey,
): CategoryHistory {
  const months = trimLeadingEmpty(expenses, detailWindow(month))
  const mine = expenses
    .filter((e) => e.category_id === categoryId)
    .sort((a, b) =>
      a.expense_date === b.expense_date
        ? b.created_at.localeCompare(a.created_at)
        : b.expense_date.localeCompare(a.expense_date),
    )

  const byMonth = new Map(months.map((m) => [m, 0]))
  for (const e of mine) {
    const m = monthKeyOfDate(e.expense_date)
    if (byMonth.has(m)) byMonth.set(m, byMonth.get(m)! + e.amount)
  }
  const totals = months.map((m) => roundMoney(byMonth.get(m)!))

  // complete months before the one in focus: the running month is only half a month
  const cutoff = month < currentMonthKey() ? month : currentMonthKey()
  const complete = months.map((m, i) => ({ month: m, total: totals[i] })).filter((r) => r.month < cutoff)
  const recent = complete.slice(-TYPICAL_OVER)
  const lastYear = months.indexOf(shiftMonth(month, -12))
  const peak = months.reduce<{ month: MonthKey; total: number } | null>(
    (best, m, i) => (totals[i] > 0 && (!best || totals[i] > best.total) ? { month: m, total: totals[i] } : best),
    null,
  )

  return {
    months,
    totals,
    typical: recent.length
      ? roundMoney(recent.reduce((a, r) => a + r.total, 0) / recent.length)
      : null,
    previous: complete.length ? complete[complete.length - 1] : null,
    sameMonthLastYear: lastYear === -1 ? null : totals[lastYear],
    peak,
    expenses: mine,
  }
}

export interface ShareRow {
  category: Category
  amount: number
  /** Share of the total across all rows, 0–1. */
  share: number
}

/**
 * Categories as pieces of a whole, biggest first. Categories switched out of
 * the Home chart (rent and other fixed costs) are left out here too, for the
 * same reason: they'd shrink everything else to slivers. The one exception is
 * the category in focus, which is always compared, whatever it is.
 */
export function shareRows(
  amounts: Record<string, number>,
  categories: Category[],
  focusId: string,
): { rows: ShareRow[]; leftOut: Category[] } {
  const focus = categories.find((c) => c.id === focusId)
  const includeFixed = focus?.show_in_chart === false
  const counted = categories.filter(
    (c) => (includeFixed || c.show_in_chart || c.id === focusId) && (amounts[c.id] ?? 0) > 0,
  )
  const leftOut = categories.filter((c) => !counted.includes(c) && (amounts[c.id] ?? 0) > 0)
  const total = counted.reduce((a, c) => a + (amounts[c.id] ?? 0), 0)
  const rows = counted
    .map((category) => {
      const amount = roundMoney(amounts[category.id] ?? 0)
      return { category, amount, share: total > 0 ? amount / total : 0 }
    })
    .sort((a, b) => b.amount - a.amount)
  return { rows, leftOut }
}

/** Per-category spending over a set of months, for "usually X% of spending". */
export function amountsOver(expenses: Expense[], months: MonthKey[]): Record<string, number> {
  const set = new Set(months)
  const out: Record<string, number> = {}
  for (const e of expenses) {
    if (set.has(monthKeyOfDate(e.expense_date))) out[e.category_id] = (out[e.category_id] ?? 0) + e.amount
  }
  return out
}
