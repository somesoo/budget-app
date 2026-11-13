import type { BudgetRow, CategoryRow, ExpenseRow } from './_month.js'
import { monthRange } from './_month.js'
import { rows } from './_tokens.js'

/*
 * What the api/v1 functions read for one month, with the secret key. Notes
 * are never selected: an allowance's notes are its owner's, and no view
 * for another app needs them.
 */

const CATEGORY = 'id,name,color,monthly_limit,sort_order,archived,kind,owner'

export const loadCategories = () => rows<CategoryRow>(`categories?select=${CATEGORY}`)

export const loadPeople = () =>
  rows<{ id: string; name: string }>('people?select=id,name&order=sort_order.asc,id.asc')

export async function loadMonth(month: string) {
  const { from, to } = monthRange(month)
  const [categories, expenses, budgets, incomes] = await Promise.all([
    loadCategories(),
    rows<ExpenseRow>(
      `expenses?select=id,amount,category_id,person,expense_date,created_at&expense_date=gte.${from}&expense_date=lte.${to}`,
    ),
    rows<BudgetRow>(`budgets?select=income,savings,limits&month=eq.${month}`),
    // pay counts for the month it was marked for, else the one it arrived in
    rows<{ amount: number }>(
      `incomes?select=amount&or=(for_month.eq.${month},and(for_month.is.null,income_date.gte.${from},income_date.lte.${to}))`,
    ),
  ])
  return { categories, expenses, budget: budgets[0] ?? null, incomes }
}
