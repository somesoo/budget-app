import { useBudget } from './useBudgets'
import { useMonthlyExpenses } from './useExpenses'
import { useIncomesBetween } from './useIncomes'
import { monthLeftover, safeToSpend } from '../lib/allocations'
import {
  currentMonthKey,
  monthRange,
  roundMoney,
  sumExpenses,
  type MonthKey,
} from '../lib/calculations'

/** A month's money: what came in, what its plan saves, what was spent, and what that leaves. */
export function useMonthMoney(month: MonthKey) {
  const { from, to } = monthRange(month)
  const { data: plan = null, isLoading: planLoading } = useBudget(month)
  const { data: expenses, isLoading: expensesLoading } = useMonthlyExpenses(month)
  const { data: incomes, isLoading: incomesLoading } = useIncomesBetween(from, to)

  const income = roundMoney((incomes ?? []).reduce((a, i) => a + i.amount, 0))
  const spent = sumExpenses(expenses ?? [])
  const savings = plan?.savings ?? 0

  return {
    isLoading: planLoading || expensesLoading || incomesLoading,
    plan,
    income,
    spent,
    safe: safeToSpend({ income, plannedIncome: plan?.income ?? 0, savings, spent }),
    leftover: monthLeftover({ income, savings, spent }),
    /** The month is over, so its leftover won't change any more. */
    final: month < currentMonthKey(),
  }
}
