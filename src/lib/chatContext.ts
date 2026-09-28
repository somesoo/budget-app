import { PERSON_LABELS } from '../config'
import type { BudgetPlan, Category, Expense, Income, SavingsMovement } from '../types'
import type { BudgetAlert } from './alerts'
import {
  daysInMonth,
  incomeMonth,
  monthKeyOfDate,
  roundMoney,
  shiftMonth,
  type MonthKey,
} from './calculations'
import { elapsedDays, monthsEndingAt, projectMonthEnd } from './insights'
import type { AccountSummary, GoalSummary } from './savings'

/*
 * What the Ask tab sends with every question: a snapshot of the household's
 * money, in plain names and numbers. Built from data the app already has,
 * computed here (never by the model), and trimmed to fit.
 */

/** Room for the snapshot; the oldest individual expenses go first when it's over. */
export const CONTEXT_MAX_CHARS = 200_000
/** Months of individual expenses, this one included. */
const EXPENSE_MONTHS = 3
/** Months of savings movements. */
const MOVEMENT_MONTHS = 6

export interface ChatContextInput {
  month: MonthKey
  today: string
  /** With this month's limits (its plan where it has one). */
  categories: Category[]
  /** The last 12 months, this one included. */
  expenses: Expense[]
  incomes: Income[]
  planThisMonth: BudgetPlan | null
  planNextMonth: BudgetPlan | null
  alerts: BudgetAlert[]
  savings: {
    available: boolean
    accounts: AccountSummary[]
    goals: GoalSummary[]
    movements: SavingsMovement[]
    savedThisMonth: number
  }
}

const who = (p: string | null) => (p ? ((PERSON_LABELS as Record<string, string>)[p] ?? p) : null)

export function buildChatContext(input: ChatContextInput): Record<string, unknown> {
  const {
    month,
    today,
    categories,
    expenses,
    incomes,
    planThisMonth,
    planNextMonth,
    alerts,
    savings,
  } = input
  const name = new Map(categories.map((c) => [c.id, c.name]))
  const monthly = categories.filter((c) => c.kind !== 'project')
  const projects = categories.filter((c) => c.kind === 'project')
  const inMonth = (m: MonthKey) => expenses.filter((e) => monthKeyOfDate(e.expense_date) === m)
  const thisMonth = inMonth(month)
  const spentBy = (list: Expense[], id: string) =>
    roundMoney(list.filter((e) => e.category_id === id).reduce((a, e) => a + e.amount, 0))

  const months = monthsEndingAt(month, 12)
  const firstMonth = shiftMonth(month, -(EXPENSE_MONTHS - 1))
  const firstMovementMonth = shiftMonth(month, -(MOVEMENT_MONTHS - 1))
  const goalName = new Map(savings.goals.map((g) => [g.goal.id, g.goal.name]))
  const accountName = new Map(savings.accounts.map((a) => [a.account.id, a.account.name]))

  const plan = (p: BudgetPlan | null) =>
    p && {
      income: p.income,
      savings: p.savings,
      savingsSplit: p.allocations.map((a) => ({
        to: a.goal_id
          ? `goal ${goalName.get(a.goal_id) ?? 'closed goal'}`
          : `account ${accountName.get(a.account_id ?? '') ?? 'hidden account'}`,
        amount: a.amount,
      })),
      note: p.note,
      limits: Object.fromEntries(
        Object.entries(p.limits).map(([id, v]) => [name.get(id) ?? 'hidden category', v]),
      ),
    }

  return {
    today,
    currency: 'PLN',
    people: Object.values(PERSON_LABELS),
    thisMonth: {
      month,
      dayOfMonth: elapsedDays(month),
      daysInMonth: daysInMonth(month),
      plan: plan(planThisMonth),
      income: roundMoney(
        incomes
          .filter((i) => incomeMonth(i) === month)
          .reduce((a, i) => a + i.amount, 0),
      ),
      categories: monthly
        .filter((c) => !c.archived || spentBy(thisMonth, c.id) > 0)
        .map((c) => {
          const spent = spentBy(thisMonth, c.id)
          return {
            name: c.name,
            limit: c.monthly_limit,
            spent,
            projectedMonthEnd: c.show_in_chart ? projectMonthEnd(spent, month) : spent,
            fixedCost: !c.show_in_chart,
          }
        }),
      warnings: alerts.map((a) => `${a.title}. ${a.detail}`),
    },
    nextMonthPlan: plan(planNextMonth),
    monthlyTotals: {
      months,
      byCategory: monthly.map((c) => ({
        name: c.name,
        amounts: months.map((m) => spentBy(inMonth(m), c.id)),
      })),
    },
    expenses: expenses
      .filter((e) => monthKeyOfDate(e.expense_date) >= firstMonth)
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
      .map((e) => ({
        date: e.expense_date,
        amount: e.amount,
        category: name.get(e.category_id) ?? 'hidden category',
        note: e.note,
        who: who(e.person),
      })),
    income: incomes
      .filter((i) => incomeMonth(i) >= firstMonth)
      .map((i) => ({
        date: i.income_date,
        amount: i.amount,
        who: who(i.person),
        note: i.note,
        oneOff: i.one_off,
      })),
    projects: projects.map((c) => ({
      name: c.name,
      budget: c.budget_total,
      starts: c.starts_on,
      ends: c.ends_on,
      spentSoFar: spentBy(expenses, c.id),
      paidFromGoal: c.goal_id ? (goalName.get(c.goal_id) ?? null) : null,
    })),
    savings: savings.available
      ? {
          savedThisMonth: savings.savedThisMonth,
          accounts: savings.accounts
            .filter((a) => !a.account.archived)
            .map((a) => ({
              name: a.account.name,
              kind: a.account.kind,
              owner: a.account.owner === 'joint' ? 'joint' : who(a.account.owner),
              interestPercent: a.account.interest_rate,
              balance: a.balance,
              unassigned: a.unassigned,
              heldForGoals: Object.fromEntries(
                Object.entries(a.byGoal).map(([id, v]) => [goalName.get(id) ?? 'goal', v]),
              ),
            })),
          goals: savings.goals
            .filter((g) => !g.goal.archived)
            .map((g) => ({
              name: g.goal.name,
              target: g.goal.target_amount || null,
              by: g.goal.target_date,
              saved: g.saved,
              stillNeeded: g.remaining,
              averagePerMonthLately: g.pace,
              status: g.status,
            })),
          movements: savings.movements
            .filter((m) => monthKeyOfDate(m.movement_date) >= firstMovementMonth)
            .map((m) => ({
              date: m.movement_date,
              account: accountName.get(m.account_id) ?? 'account',
              kind: m.kind,
              amount: m.amount,
              goal: m.goal_id ? (goalName.get(m.goal_id) ?? null) : null,
              note: m.note,
            })),
        }
      : null,
  }
}

/**
 * Keeps the snapshot under `max` characters of JSON: drops the oldest
 * individual expenses first (the monthly totals still cover them), then the
 * oldest savings movements.
 */
export function trimContext(ctx: Record<string, unknown>, max = CONTEXT_MAX_CHARS) {
  const out = { ...ctx } as Record<string, unknown> & {
    expenses?: unknown[]
    savings?: { movements?: unknown[] } | null
  }
  const size = () => JSON.stringify(out).length
  if (size() <= max) return out
  const expenses = [...(out.expenses ?? [])]
  while (expenses.length > 0 && size() > max) {
    // newest first, so the end is the oldest; drop in chunks to keep this quick
    expenses.splice(Math.max(expenses.length - 25, 0))
    out.expenses = expenses
  }
  if (out.savings?.movements) {
    const movements = [...out.savings.movements]
    out.savings = { ...out.savings, movements }
    while (movements.length > 0 && size() > max) {
      movements.splice(Math.max(movements.length - 25, 0))
      out.savings = { ...out.savings, movements: [...movements] }
    }
  }
  return out
}
