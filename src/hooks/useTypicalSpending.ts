import { useMonthlyExpensesBetween } from './useExpenses'
import { currentMonthKey, monthKeyOfDate, shiftMonth } from '../lib/calculations'
import { monthsEndingAt, windowRange } from '../lib/insights'

/** Complete months averaged over. */
const MONTHS = 3

/**
 * What a month typically costs: monthly spending (trips left out) averaged
 * over the last complete months that have anything logged; a month with
 * nothing is a gap in the record, not a month that cost nothing. Like the
 * planner, it learns from the current chapter only unless this phone lets
 * past ones count. Null until there's any.
 */
export function useTypicalSpending(): number | null {
  const months = monthsEndingAt(shiftMonth(currentMonthKey(), -1), MONTHS)
  const { from, to } = windowRange(months)
  const { data: expenses } = useMonthlyExpensesBetween(from, to, 'plan')
  if (!expenses) return null
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const logged = new Set(expenses.map((e) => monthKeyOfDate(e.expense_date))).size
  return total > 0 ? total / logged : null
}
