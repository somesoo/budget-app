import { useMonthCategories } from './useBudgets'
import { useMonthlyExpenses } from './useExpenses'
import { useIncomesBetween } from './useIncomes'
import { useSavings } from './useSavings'
import {
  monthLeftover,
  monthSavingsFlow,
  safeToSpend,
  unpaidFixedCosts,
} from '../lib/allocations'
import {
  currentMonthKey,
  monthRange,
  roundMoney,
  sumByCategory,
  sumExpenses,
  type MonthKey,
} from '../lib/calculations'

/** A month's money: what came in, what its plan saves, what was spent, and what that leaves. */
export function useMonthMoney(month: MonthKey) {
  const { from, to } = monthRange(month)
  // limits as the month's plan sets them
  const { data: categories = [], plan, planLoading } = useMonthCategories(month)
  const { data: expenses, isLoading: expensesLoading } = useMonthlyExpenses(month)
  const { data: incomes, isLoading: incomesLoading } = useIncomesBetween(from, to)
  const { data: savingsData } = useSavings()

  const income = roundMoney((incomes ?? []).reduce((a, i) => a + i.amount, 0))
  const spent = sumExpenses(expenses ?? [])
  const savings = plan?.savings ?? 0
  // extra saved or taken back out of savings this month moves what's free
  const flow = monthSavingsFlow(savingsData?.movements ?? [], month)
  // rent and bills not paid yet are spoken for; a finished month has nothing left to pay
  const reserved =
    month < currentMonthKey() ? 0 : unpaidFixedCosts(categories, sumByCategory(expenses ?? []))

  return {
    isLoading: planLoading || expensesLoading || incomesLoading,
    plan,
    income,
    spent,
    ...flow,
    safe: safeToSpend({
      income,
      plannedIncome: plan?.income ?? 0,
      savings,
      spent,
      reserved,
      ...flow,
    }),
    leftover: monthLeftover({ income, savings, spent, ...flow }),
    /** The month is over, so its leftover won't change any more. */
    final: month < currentMonthKey(),
  }
}
