import { LOCALE } from '../config'
import type { Recurring, Suggestion } from './suggestions'
import type {
  BudgetPlan,
  Category,
  Expense,
  Goal,
  Income,
  PlanAllocation,
  PlanCarryover,
} from '../types'
import {
  currentMonthKey,
  formatMonth,
  monthKeyOfDate,
  roundMoney,
  shiftMonth,
  type MonthKey,
} from './calculations'

/*
 * Planning a month. The numbers here — what a category usually costs, what
 * came in — are arithmetic over past months and stay in code. Gemini only
 * drafts a plan from them; every figure the planner shows as history is ours.
 */

/** How many months back the planner looks: a year, so "same month last year" exists. */
export const PLAN_HISTORY_MONTHS = 12
/** "Typical" is the average of this many most recent complete months. */
const TYPICAL_OVER = 3

/**
 * Complete months usable as history for planning `target`: before the target,
 * and before the running month (a half-finished month would drag averages down).
 * Oldest first.
 */
export function historyMonths(target: MonthKey): MonthKey[] {
  const cap = target < currentMonthKey() ? target : currentMonthKey()
  return Array.from({ length: PLAN_HISTORY_MONTHS }, (_, i) =>
    shiftMonth(cap, i - PLAN_HISTORY_MONTHS),
  )
}

export interface CategoryBaseline {
  category: Category
  /** Spending per history month, aligned with `PlanBaseline.months`. */
  history: number[]
  /** Average of the last few complete months, or null with no history. */
  typical: number | null
  /** The last complete month. */
  last: number | null
  /** The same calendar month a year earlier — Decembers look like Decembers. */
  sameMonthLastYear: number | null
}

export interface PlanBaseline {
  /** Complete months with data, oldest first — months before the first expense are left out. */
  months: MonthKey[]
  categories: CategoryBaseline[]
  /** Average income over the last complete months that had any. */
  typicalIncome: number | null
  incomeHistory: number[]
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function planBaseline(args: {
  target: MonthKey
  expenses: Expense[]
  incomes: Income[]
  categories: Category[]
}): PlanBaseline {
  const { target, expenses, incomes, categories } = args
  const all = historyMonths(target)

  const first = expenses.reduce<MonthKey | null>((min, e) => {
    const m = monthKeyOfDate(e.expense_date)
    return min === null || m < min ? m : min
  }, null)
  const months = first ? all.filter((m) => m >= first) : []
  const index = new Map(months.map((m, i) => [m, i]))

  const perCategory = new Map<string, number[]>()
  for (const e of expenses) {
    const i = index.get(monthKeyOfDate(e.expense_date))
    if (i === undefined) continue
    let row = perCategory.get(e.category_id)
    if (!row) perCategory.set(e.category_id, (row = months.map(() => 0)))
    row[i] += e.amount
  }

  const lastYear = shiftMonth(target, -12)
  const recent = Math.max(months.length - TYPICAL_OVER, 0)

  const incomeHistory = months.map(() => 0)
  for (const inc of incomes) {
    const i = index.get(monthKeyOfDate(inc.income_date))
    if (i !== undefined) incomeHistory[i] += inc.amount
  }
  const paidMonths = incomeHistory.filter((x) => x > 0).slice(-TYPICAL_OVER)

  return {
    months,
    categories: categories.map((category) => {
      const history = (perCategory.get(category.id) ?? months.map(() => 0)).map(roundMoney)
      const typical = mean(history.slice(recent))
      const ly = index.get(lastYear)
      return {
        category,
        history,
        typical: typical === null ? null : roundMoney(typical),
        last: history.length ? history[history.length - 1] : null,
        sameMonthLastYear: ly === undefined ? null : history[ly],
      }
    }),
    typicalIncome: paidMonths.length ? roundMoney(mean(paidMonths)!) : null,
    incomeHistory: incomeHistory.map(roundMoney),
  }
}

/** Plans are made in round numbers — up to the next 10 zł. */
export function roundUpPlan(amount: number): number {
  return Math.ceil(amount / 10) * 10
}

/* ---------- the draft being edited ---------- */

export interface PlanDraft {
  income: number
  /** The total put aside, allocations included. */
  savings: number
  limits: Record<string, number>
  /** Where the savings go, see lib/allocations. */
  allocations: PlanAllocation[]
  /** The goal last month's unspent money goes to. */
  carryover: PlanCarryover | null
  note: string
}

export type FillSource = 'defaults' | 'typical' | 'previous'

/** A starting point for the planner: the month's own plan if it has one, else `source`. */
export function draftFrom(args: {
  source: FillSource
  categories: Category[]
  baseline: PlanBaseline
  previousPlan: BudgetPlan | null
  existing?: BudgetPlan | null
  /** Which of last month's savings lines carry over (not those of closed goals and accounts). */
  keepAllocation?: (a: PlanAllocation) => boolean
  /**
   * Which of the month's own saved lines still point somewhere: a deleted
   * account's line drops out, and its money counts as other savings.
   */
  keepExisting?: (a: PlanAllocation) => boolean
  /**
   * This month's instalments on loans from savings (lib/loans). A new plan
   * pays them instead of whatever last month's plan paid back.
   */
  instalments?: PlanAllocation[]
}): PlanDraft {
  const {
    source,
    categories,
    baseline,
    previousPlan,
    existing,
    keepAllocation = () => true,
    keepExisting = () => true,
    instalments = [],
  } = args
  if (existing) {
    const carryover = existing.carryover
    return {
      income: existing.income,
      savings: existing.savings,
      limits: Object.fromEntries(
        categories.map((c) => [c.id, existing.limits[c.id] ?? c.monthly_limit]),
      ),
      allocations: existing.allocations.filter(keepExisting),
      carryover: carryover && keepExisting({ ...carryover, amount: 0 }) ? carryover : null,
      note: existing.note ?? '',
    }
  }
  const previousLines = previousPlan?.allocations ?? []
  const sum = (lines: PlanAllocation[]) => lines.reduce((s, a) => s + a.amount, 0)
  const lastInstalments = previousLines.filter((a) => a.loan_id)
  const allocations = [
    ...previousLines.filter((a) => !a.loan_id && keepAllocation(a)),
    ...instalments,
  ]
  const lastCarryover = previousPlan?.carryover ?? null

  const typicalById = new Map(baseline.categories.map((b) => [b.category.id, b.typical]))
  const limits = Object.fromEntries(
    categories.map((c) => {
      if (source === 'previous' && previousPlan && c.id in previousPlan.limits) {
        return [c.id, previousPlan.limits[c.id]]
      }
      if (source === 'typical') {
        const t = typicalById.get(c.id)
        if (t !== null && t !== undefined) return [c.id, roundUpPlan(t)]
      }
      return [c.id, c.monthly_limit]
    }),
  )
  return {
    income:
      source === 'previous' && previousPlan
        ? previousPlan.income
        : roundMoney(baseline.typicalIncome ?? previousPlan?.income ?? 0),
    // what went to a goal that has since closed goes back to "other savings";
    // last month's instalments make way for this month's
    savings: roundMoney(
      Math.max((previousPlan?.savings ?? 0) - sum(lastInstalments), 0) + sum(instalments),
    ),
    limits,
    allocations,
    carryover:
      lastCarryover && keepAllocation({ ...lastCarryover, amount: 0 }) ? lastCarryover : null,
    note: '',
  }
}

export function draftTotals(draft: PlanDraft, activeIds: string[]) {
  const spending = roundMoney(activeIds.reduce((a, id) => a + (draft.limits[id] ?? 0), 0))
  // zero-based: every złoty of income gets a job — spending, savings, or it's "unassigned"
  const unassigned = roundMoney(draft.income - draft.savings - spending)
  return { spending, unassigned }
}

export function plannerReady(args: {
  categoriesLoaded: boolean
  existingLoaded: boolean
  previousLoaded: boolean
  expensesLoaded: boolean
  incomesLoaded: boolean
}) {
  return (
    args.categoriesLoaded &&
    args.existingLoaded &&
    args.previousLoaded &&
    args.expensesLoaded &&
    args.incomesLoaded
  )
}

/* ---------- what the server (and Gemini) receives ---------- */

/**
 * Monthly totals per category and of income, the goal, the note you typed
 * about the month, and what the app suggests from the history: including the
 * names of yearly bills and regular payments (their notes), so the draft can
 * plan for them by name. Categories go by a short key rather than their
 * database id.
 */
export interface PlanRequest {
  month: MonthKey
  monthName: string
  currency: 'PLN'
  historyMonths: string[]
  income: { planned: number; typicalMonthly: number | null; history: number[] }
  savings: { planned: number }
  categories: {
    key: string
    name: string
    defaultLimit: number
    planned: number
    history: number[]
    typicalMonthly: number | null
    sameMonthLastYear: number | null
  }[]
  goal: { name: string; target: number; saved: number } | null
  note: string | null
  /** What the app itself suggests from the history (lib/suggestions), for the draft to weigh. */
  suggestions: { key: string; kind: string; proposed: number; title: string; detail: string }[]
  /** Payments that come every month: the certain part of the plan. */
  recurring: { key: string; note: string; amount: number }[]
}

const shortMonth = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: 'numeric' })

export function buildPlanRequest(args: {
  target: MonthKey
  draft: PlanDraft
  baseline: PlanBaseline
  goal: Goal | null | undefined
  suggestions?: Suggestion[]
  recurring?: Recurring[]
}): { request: PlanRequest; keyToId: Record<string, string> } {
  const { target, draft, baseline, goal, suggestions = [], recurring = [] } = args
  const keyToId: Record<string, string> = {}
  const categories = baseline.categories.map((b, i) => {
    const key = `c${i + 1}`
    keyToId[key] = b.category.id
    return {
      key,
      name: b.category.name,
      defaultLimit: b.category.monthly_limit,
      planned: draft.limits[b.category.id] ?? b.category.monthly_limit,
      history: b.history.map(Math.round),
      typicalMonthly: b.typical === null ? null : Math.round(b.typical),
      sameMonthLastYear: b.sameMonthLastYear === null ? null : Math.round(b.sameMonthLastYear),
    }
  })

  const idToKey = Object.fromEntries(Object.entries(keyToId).map(([key, id]) => [id, key]))

  return {
    keyToId,
    request: {
      month: target,
      monthName: formatMonth(target),
      currency: 'PLN',
      historyMonths: baseline.months.map((m) => {
        const [y, mm] = m.split('-').map(Number)
        return shortMonth.format(new Date(y, mm - 1, 1))
      }),
      income: {
        planned: draft.income,
        typicalMonthly: baseline.typicalIncome,
        history: baseline.incomeHistory.map(Math.round),
      },
      savings: { planned: draft.savings },
      categories,
      goal: goal
        ? { name: goal.name, target: goal.target_amount, saved: goal.current_amount }
        : null,
      note: draft.note.trim() ? draft.note.trim().slice(0, 500) : null,
      suggestions: suggestions
        .filter((x) => idToKey[x.categoryId])
        .map((x) => ({
          key: idToKey[x.categoryId],
          kind: x.kind,
          proposed: x.limit,
          title: x.title.slice(0, 120),
          detail: x.detail.slice(0, 300),
        })),
      recurring: recurring
        .filter((r) => idToKey[r.categoryId])
        .slice(0, 20)
        .map((r) => ({
          key: idToKey[r.categoryId],
          note: r.note.slice(0, 60),
          amount: Math.round(r.amount),
        })),
    },
  }
}
