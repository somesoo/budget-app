import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category, Expense } from '../types'
import { planBaseline, plannerReady, type PlanDraft } from './planning'
import {
  annualBills,
  monthReview,
  planChecks,
  planSuggestions,
  recurringCosts,
} from './suggestions'

const cat = (id: string, limit: number, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  color: '#3987e5',
  monthly_limit: limit,
  sort_order: 0,
  archived: false,
  show_in_chart: true,
  kind: 'monthly',
  budget_total: null,
  starts_on: null,
  ends_on: null,
  goal_id: null,
  ...extra,
})

let n = 0
const exp = (
  category_id: string,
  amount: number,
  month: string,
  note: string | null = null,
): Expense => ({
  id: `e${n++}`,
  amount,
  category_id,
  person: 'bubs',
  note,
  expense_date: `${month}-10`,
  created_at: '2026-01-01T00:00:00Z',
})

// Planning October 2026 in late September: history is Sep 2025 to Aug 2026
const TARGET = '2026-10'
const HISTORY = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, 8 + i, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

/** One expense per history month for a category, from a list of 12 amounts. */
const monthly = (id: string, amounts: number[], note: string | null = null) =>
  amounts.map((a, i) => exp(id, a, HISTORY[i], note))

const flat = (x: number) => Array(12).fill(x)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 26, 12))
})
afterEach(() => vi.useRealTimers())

function suggest(categories: Category[], expenses: Expense[], limits: Record<string, number>) {
  const baseline = planBaseline({ target: TARGET, expenses, incomes: [], categories })
  return planSuggestions({ target: TARGET, baseline, draftLimits: limits, expenses })
}

describe('planSuggestions', () => {
  it('suggests raising a category over its limit three months running', () => {
    const [s] = suggest([cat('food', 1500)], monthly('food', flat(1700)), { food: 1500 })
    expect(s).toMatchObject({ kind: 'raise', categoryId: 'food', limit: 1700 })
  })

  it('suggests lowering one well under, and says what it frees', () => {
    const [s] = suggest([cat('fun', 500)], monthly('fun', flat(300)), { fun: 500 })
    expect(s).toMatchObject({ kind: 'lower', limit: 300 })
    expect(s.detail).toContain('frees 200 zł')
  })

  it('drops a suggestion once the draft follows it', () => {
    expect(suggest([cat('food', 1500)], monthly('food', flat(1700)), { food: 1700 })).toEqual([])
  })

  it("finds last year's bill for the same month", () => {
    const expenses = [...monthly('car', flat(200)), exp('car', 1200, '2025-10', 'Car insurance')]
    const [s] = suggest([cat('car', 200)], expenses, { car: 200 })
    expect(s).toMatchObject({ kind: 'annual', limit: 1400, noteLine: 'Car insurance ~1,200 zł' })
  })

  it("doesn't undo a planned yearly bill by suggesting the usual limit", () => {
    const expenses = [...monthly('car', flat(200)), exp('car', 1200, '2025-10', 'Car insurance')]
    expect(suggest([cat('car', 200)], expenses, { car: 1400 })).toEqual([])
  })

  it('offers room for a category that swings a lot', () => {
    // last October was an ordinary month, so this is swing, not season
    const amounts = [100, 150, 400, 500, 120, 450, 100, 420, 130, 480, 110, 300]
    const [s] = suggest([cat('gifts', 300)], monthly('gifts', amounts), { gifts: 300 })
    expect(s?.kind).toBe('buffer')
  })

  it('says nothing about a category that keeps to its limit', () => {
    expect(suggest([cat('food', 1500)], monthly('food', flat(1400)), { food: 1500 })).toEqual([])
  })
})

describe('annualBills', () => {
  it('leaves out a bill that came back later in the year', () => {
    const expenses = [exp('fun', 150, '2025-10', 'Concert'), exp('fun', 150, '2026-03', 'concert ')]
    expect(annualBills(expenses, TARGET, HISTORY)).toEqual([])
  })
})

describe('recurringCosts', () => {
  it('lists what comes every month for about the same amount', () => {
    const expenses = [
      ...monthly('fun', [...Array(9).fill(0), 49, 49, 52], 'Netflix'),
      ...monthly('fun', [...Array(9).fill(0), 30, 90, 10], 'Cinema'),
    ].filter((e) => e.amount > 0)
    expect(recurringCosts(expenses, HISTORY)).toEqual([
      { categoryId: 'fun', note: 'Netflix', amount: 52, months: 3 },
    ])
  })
})

describe('recurringCosts, shops', () => {
  it('leaves out a shop visited several times a month, even when the sums match', () => {
    const expenses = HISTORY.slice(-3).flatMap((m) => [
      exp('food', 180, m, 'Lidl'),
      exp('food', 180, m, 'Lidl'),
    ])
    expect(recurringCosts(expenses, HISTORY)).toEqual([])
  })
})

describe('planChecks', () => {
  const baseline = () =>
    planBaseline({
      target: TARGET,
      expenses: monthly('food', flat(1600)),
      incomes: [],
      categories: [cat('food', 1500)],
    })
  const draft = (p: Partial<PlanDraft>): PlanDraft => ({
    income: 5000,
    savings: 500,
    limits: { food: 1500 },
    allocations: [],
    carryover: [],
    carryoverKeep: 0,
    note: '',
    ...p,
  })

  it('flags a limit below every recent month', () => {
    const checks = planChecks({
      draft: draft({}),
      baseline: baseline(),
      activeIds: ['food'],
      goal: null,
    })
    expect(checks.find((c) => c.text.startsWith('food is planned below'))?.ok).toBe(false)
  })

  it('reports unassigned income and the savings rate', () => {
    const texts = planChecks({
      draft: draft({}),
      baseline: baseline(),
      activeIds: ['food'],
      goal: null,
    }).map((c) => c.text)
    expect(texts).toContain('3,000 zł of income has no job yet.')
    expect(texts).toContain('Saving 10% of income.')
  })
})

describe('monthReview', () => {
  it('sorts the month into over and well under', () => {
    const r = monthReview({
      month: '2026-08',
      expenses: [exp('a', 700, '2026-08'), exp('b', 100, '2026-08')],
      categories: [cat('a', 500), cat('b', 400)],
      income: 5000,
      plannedSavings: 1000,
    })
    expect(r.over.map((x) => x.category.id)).toEqual(['a'])
    expect(r.under.map((x) => x.category.id)).toEqual(['b'])
    expect(r.saved).toBe(4200)
  })
})

describe('plannerReady', () => {
  it('treats an empty categories list as ready once the queries complete', () => {
    expect(
      plannerReady({
        categoriesLoaded: true,
        existingLoaded: true,
        previousLoaded: true,
        expensesLoaded: true,
        incomesLoaded: true,
      }),
    ).toBe(true)
    expect(
      plannerReady({
        categoriesLoaded: false,
        existingLoaded: true,
        previousLoaded: true,
        expensesLoaded: true,
        incomesLoaded: true,
      }),
    ).toBe(false)
  })
})
