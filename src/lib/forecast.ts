import { PERSON_LABELS } from '../config'
import type { Category, Expense, Goal, Income, Person } from '../types'
import { PERSONS } from '../types'
import { daysInMonth, monthKeyOfDate, roundMoney, type MonthKey } from './calculations'
import { elapsedDays, projectMonthEnd } from './insights'

/*
 * The forecast is arithmetic and stays in code. Gemini never computes a number
 * the app shows as fact — it receives these results and writes advice about them.
 */

export interface IncomeExpectation {
  person: Person
  /** Already logged this month. */
  logged: number
  /** Average monthly income over earlier months that had any, or null if none. */
  typical: number | null
  /** What the forecast counts on. */
  expected: number
  basis: 'logged' | 'typical' | 'none'
}

/**
 * Expected income per person for `month`. Once a paycheck is logged it wins,
 * even if it's below the usual — the forecast should err towards caution,
 * and an optimistic one is the kind that gets people into trouble. Until then,
 * the person's typical month stands in. A past month simply uses what was logged.
 */
export function expectedIncome(
  incomes: Income[],
  month: MonthKey,
  isCurrent: boolean,
): IncomeExpectation[] {
  return PERSONS.map((person) => {
    const mine = incomes.filter((i) => i.person === person)
    const logged = roundMoney(
      mine.filter((i) => monthKeyOfDate(i.income_date) === month).reduce((a, i) => a + i.amount, 0),
    )

    const byMonth = new Map<MonthKey, number>()
    for (const i of mine) {
      const m = monthKeyOfDate(i.income_date)
      if (m < month) byMonth.set(m, (byMonth.get(m) ?? 0) + i.amount)
    }
    const typical = byMonth.size
      ? roundMoney([...byMonth.values()].reduce((a, b) => a + b, 0) / byMonth.size)
      : null

    if (logged > 0 || !isCurrent) {
      return { person, logged, typical, expected: logged, basis: logged > 0 ? 'logged' : 'none' }
    }
    return {
      person,
      logged,
      typical,
      expected: typical ?? 0,
      basis: typical !== null ? 'typical' : 'none',
    }
  })
}

export interface MonthForecast {
  income: number
  incomeByPerson: IncomeExpectation[]
  spentSoFar: number
  /** Projection for the running month, the actual total for a past one. */
  projectedSpend: number
  projectedSavings: number
  savingsRate: number | null
  /** Break-even: what can still be spent per day without dipping below zero. */
  perDayToBreakEven: number | null
  daysLeft: number
  monthsToGoal: number | null
}

export function monthForecast(args: {
  month: MonthKey
  isCurrent: boolean
  expenses: Expense[]
  incomes: Income[]
  goal: Goal | null | undefined
}): MonthForecast {
  const { month, isCurrent, expenses, incomes, goal } = args
  const incomeByPerson = expectedIncome(incomes, month, isCurrent)
  const income = roundMoney(incomeByPerson.reduce((a, p) => a + p.expected, 0))

  const spentSoFar = roundMoney(
    expenses
      .filter((e) => monthKeyOfDate(e.expense_date) === month)
      .reduce((a, e) => a + e.amount, 0),
  )
  const projectedSpend = isCurrent ? projectMonthEnd(spentSoFar, month) ?? spentSoFar : spentSoFar
  const projectedSavings = roundMoney(income - projectedSpend)

  const daysLeft = isCurrent ? daysInMonth(month) - elapsedDays(month) : 0
  const perDayToBreakEven =
    isCurrent && income > 0 && daysLeft > 0
      ? roundMoney(Math.max(income - spentSoFar, 0) / daysLeft)
      : null

  const remainingToGoal = goal ? Math.max(goal.target_amount - goal.current_amount, 0) : 0
  const monthsToGoal =
    goal && remainingToGoal > 0 && projectedSavings > 0
      ? Math.ceil(remainingToGoal / projectedSavings)
      : null

  return {
    income,
    incomeByPerson,
    spentSoFar,
    projectedSpend,
    projectedSavings,
    savingsRate: income > 0 ? projectedSavings / income : null,
    perDayToBreakEven,
    daysLeft,
    monthsToGoal,
  }
}

/* ---------- what the server (and Gemini) receives ---------- */

/**
 * Aggregates only: totals per category and person, income, the goal. No notes,
 * no individual transactions, no account details.
 */
export interface AdviceRequest {
  month: MonthKey
  dayOfMonth: number
  daysInMonth: number
  currency: 'PLN'
  income: {
    expected: number
    byPerson: { name: string; logged: number; typicalMonthly: number | null; counted: number }[]
  }
  spending: { soFar: number; projectedMonthEnd: number; limitsTotal: number }
  categories: { name: string; monthlyLimit: number; spentSoFar: number; typicalMonthly: number | null }[]
  people: { name: string; spentSoFar: number }[]
  goal: { name: string; target: number; saved: number } | null
  forecast: { projectedSavings: number; savingsRate: number | null; monthsToGoal: number | null }
}

export function buildAdviceRequest(args: {
  month: MonthKey
  expenses: Expense[]
  categories: Category[]
  goal: Goal | null | undefined
  forecast: MonthForecast
}): AdviceRequest {
  const { month, expenses, categories, goal, forecast } = args
  const inMonth = expenses.filter((e) => monthKeyOfDate(e.expense_date) === month)
  const earlier = expenses.filter((e) => monthKeyOfDate(e.expense_date) < month)
  const earlierMonths = new Set(earlier.map((e) => monthKeyOfDate(e.expense_date))).size

  return {
    month,
    dayOfMonth: elapsedDays(month),
    daysInMonth: daysInMonth(month),
    currency: 'PLN',
    income: {
      expected: forecast.income,
      byPerson: forecast.incomeByPerson.map((p) => ({
        name: PERSON_LABELS[p.person],
        logged: p.logged,
        typicalMonthly: p.typical,
        counted: p.expected,
      })),
    },
    spending: {
      soFar: forecast.spentSoFar,
      projectedMonthEnd: Math.round(forecast.projectedSpend),
      limitsTotal: categories.reduce((a, c) => a + c.monthly_limit, 0),
    },
    categories: categories.map((c) => {
      const spent = inMonth.filter((e) => e.category_id === c.id).reduce((a, e) => a + e.amount, 0)
      const before = earlier.filter((e) => e.category_id === c.id).reduce((a, e) => a + e.amount, 0)
      return {
        name: c.name,
        monthlyLimit: c.monthly_limit,
        spentSoFar: roundMoney(spent),
        typicalMonthly: earlierMonths ? Math.round(before / earlierMonths) : null,
      }
    }),
    people: PERSONS.map((p) => ({
      name: PERSON_LABELS[p],
      spentSoFar: roundMoney(inMonth.filter((e) => e.person === p).reduce((a, e) => a + e.amount, 0)),
    })),
    goal: goal
      ? { name: goal.name, target: goal.target_amount, saved: goal.current_amount }
      : null,
    forecast: {
      projectedSavings: Math.round(forecast.projectedSavings),
      savingsRate: forecast.savingsRate !== null ? Math.round(forecast.savingsRate * 100) / 100 : null,
      monthsToGoal: forecast.monthsToGoal,
    },
  }
}
