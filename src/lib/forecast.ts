import { PERSON_LABELS } from '../config'
import type { BudgetAlert } from './alerts'
import type { ProjectSummary } from './projects'
import type { AccountSummary, GoalSummary } from './savings'
import type { Category, Expense, Goal, Income, Person } from '../types'
import { PERSONS } from '../types'
import { daysInMonth, incomeMonth, monthKeyOfDate, roundMoney, type MonthKey } from './calculations'
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
      mine.filter((i) => incomeMonth(i) === month).reduce((a, i) => a + i.amount, 0),
    )

    const byMonth = new Map<MonthKey, number>()
    for (const i of mine) {
      const m = incomeMonth(i)
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
  const projectedSpend = isCurrent ? (projectMonthEnd(spentSoFar, month) ?? spentSoFar) : spentSoFar
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
 * Totals per category and person, income, the app's warnings, the month's
 * biggest expenses (with notes), savings accounts, goals and projects.
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
  categories: {
    name: string
    monthlyLimit: number
    spentSoFar: number
    typicalMonthly: number | null
  }[]
  people: { name: string; spentSoFar: number }[]
  goal: { name: string; target: number; saved: number } | null
  forecast: { projectedSavings: number; savingsRate: number | null; monthsToGoal: number | null }
  /** The app's own warnings this month (over a limit, heading over). */
  warnings: string[]
  /** This month's biggest single expenses, with their notes. */
  biggestExpenses: {
    date: string
    amount: number
    category: string
    note: string | null
    who: string
  }[]
  /** Accounts and goals; null before savings accounts exist (migration 0007). */
  savings: {
    savedThisMonth: number
    plannedThisMonth: number | null
    totalSaved: number
    unassigned: number
    accounts: { name: string; balance: number; interestPercent: number | null }[]
    goals: {
      name: string
      target: number | null
      by: string | null
      saved: number
      neededPerMonth: number | null
      onTrack: boolean | null
    }[]
  } | null
  /** Trips and projects, outside the monthly numbers. */
  projects: { name: string; budget: number | null; spent: number; phase: string }[]
}

/** How many of the month's biggest expenses go along. */
const BIGGEST = 12

export function buildAdviceRequest(args: {
  month: MonthKey
  expenses: Expense[]
  categories: Category[]
  goal: Goal | null | undefined
  forecast: MonthForecast
  alerts?: BudgetAlert[]
  savings?: {
    available: boolean
    savedThisMonth: number
    plannedThisMonth: number | null
    total: number
    unassigned: number
    accounts: AccountSummary[]
    goals: GoalSummary[]
  }
  projects?: ProjectSummary[]
}): AdviceRequest {
  const { month, expenses, categories, goal, forecast, alerts = [], savings, projects = [] } = args
  const nameOf = new Map(categories.map((c) => [c.id, c.name]))
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
      spentSoFar: roundMoney(
        inMonth.filter((e) => e.person === p).reduce((a, e) => a + e.amount, 0),
      ),
    })),
    goal: goal ? { name: goal.name, target: goal.target_amount, saved: goal.current_amount } : null,
    forecast: {
      projectedSavings: Math.round(forecast.projectedSavings),
      savingsRate:
        forecast.savingsRate !== null ? Math.round(forecast.savingsRate * 100) / 100 : null,
      monthsToGoal: forecast.monthsToGoal,
    },
    warnings: alerts.map((a) => `${a.title}. ${a.detail}`.slice(0, 300)).slice(0, 12),
    biggestExpenses: [...inMonth]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, BIGGEST)
      .map((e) => ({
        date: e.expense_date,
        amount: e.amount,
        category: (nameOf.get(e.category_id) ?? 'other').slice(0, 60),
        note: e.note ? e.note.slice(0, 80) : null,
        who: PERSON_LABELS[e.person],
      })),
    savings:
      savings && savings.available
        ? {
            savedThisMonth: savings.savedThisMonth,
            plannedThisMonth: savings.plannedThisMonth,
            totalSaved: savings.total,
            unassigned: savings.unassigned,
            accounts: savings.accounts
              .filter((a) => !a.account.archived)
              .slice(0, 20)
              .map((a) => ({
                name: a.account.name.slice(0, 60),
                balance: a.balance,
                interestPercent: a.account.interest_rate,
              })),
            goals: savings.goals
              .filter((g) => !g.goal.archived)
              .slice(0, 20)
              .map((g) => ({
                name: g.goal.name.slice(0, 60),
                target: g.goal.target_amount || null,
                by: g.goal.target_date,
                saved: g.saved,
                neededPerMonth:
                  g.status.kind === 'on-track' || g.status.kind === 'behind'
                    ? g.status.neededPerMonth
                    : null,
                onTrack:
                  g.status.kind === 'on-track' || g.status.kind === 'reached'
                    ? true
                    : g.status.kind === 'behind' || g.status.kind === 'overdue'
                      ? false
                      : null,
              })),
          }
        : null,
    projects: projects
      .filter((p) => !p.project.archived)
      .slice(0, 10)
      .map((p) => ({
        name: p.project.name.slice(0, 60),
        budget: p.budget,
        spent: p.spent,
        phase: p.phase,
      })),
  }
}
