import { useMemo } from 'react'
import { monthRange, type MonthKey } from '../lib/calculations'
import { paySplit } from '../lib/paySplit'
import { useCategories } from './useCategories'
import { useMonthlyExpensesBetween } from './useExpenses'
import { useIncomesBetween } from './useIncomes'
import { useRecurringCosts } from './useRecurring'
import { useSavings } from './useSavings'

/** Where `month`'s pay went (see lib/paySplit); null while loading. */
export function usePaySplit(month: MonthKey) {
  const { from, to } = monthRange(month)
  const { data: categories } = useCategories()
  const { data: expenses } = useMonthlyExpensesBetween(from, to)
  const { data: incomes } = useIncomesBetween(from, to)
  const { data: savings } = useSavings()
  const { data: recurring } = useRecurringCosts()

  return useMemo(() => {
    if (!categories || !expenses || !incomes) return null
    const billCategoryIds = new Set(
      (recurring?.costs ?? [])
        .filter((c) => !c.archived && c.category_id)
        .map((c) => c.category_id!),
    )
    return paySplit({
      month,
      incomes,
      expenses,
      categories,
      movements: savings?.movements ?? [],
      accounts: savings?.accounts ?? [],
      billCategoryIds,
    })
  }, [month, categories, expenses, incomes, savings, recurring])
}
