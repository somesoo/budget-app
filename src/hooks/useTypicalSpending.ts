import { useMonthlyExpensesBetween } from './useExpenses'
import { currentMonthKey, shiftMonth } from '../lib/calculations'
import { monthsEndingAt, windowRange } from '../lib/insights'

/** Complete months averaged over. */
const MONTHS = 3

/**
 * What a month typically costs: monthly spending (trips left out) averaged
 * over the last complete months. Null until there's any.
 */
export function useTypicalSpending(): number | null {
  const months = monthsEndingAt(shiftMonth(currentMonthKey(), -1), MONTHS)
  const { from, to } = windowRange(months)
  const { data: expenses } = useMonthlyExpensesBetween(from, to)
  if (!expenses) return null
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  return total > 0 ? total / months.length : null
}
