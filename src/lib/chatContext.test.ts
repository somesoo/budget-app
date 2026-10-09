import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category, Expense } from '../types'
import { buildChatContext, trimContext } from './chatContext'

const cat = (id: string, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  color: '#3987e5',
  monthly_limit: 500,
  sort_order: 0,
  archived: false,
  show_in_chart: true,
  kind: 'monthly',
  budget_total: null,
  starts_on: null,
  ends_on: null,
  goal_id: null,
  owner: null,
  spending_group: null,
  ...extra,
})

let n = 0
const exp = (
  category_id: string,
  amount: number,
  date: string,
  note: string | null = null,
): Expense => ({
  id: `e${n++}`,
  amount,
  category_id,
  person: 'bubs',
  note,
  expense_date: date,
  created_at: '2026-01-01T00:00:00Z',
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 20, 12))
})
afterEach(() => vi.useRealTimers())

const base = {
  month: '2026-09',
  today: '2026-09-20',
  incomes: [],
  planThisMonth: null,
  planNextMonth: null,
  alerts: [],
  savings: { available: false, accounts: [], goals: [], movements: [], savedThisMonth: 0 },
}

describe('buildChatContext', () => {
  it('keeps projects out of the month and lists them on their own', () => {
    const ctx = buildChatContext({
      ...base,
      categories: [cat('food'), cat('Japan', { kind: 'project', budget_total: 12000 })],
      expenses: [
        exp('food', 100, '2026-09-02', 'Lidl'),
        exp('Japan', 900, '2026-09-05', 'Flights'),
      ],
    }) as {
      thisMonth: { categories: { name: string; spent: number }[] }
      projects: { name: string; spentSoFar: number }[]
      expenses: { note: string | null; who: string | null }[]
    }
    expect(ctx.thisMonth.categories.map((c) => c.name)).toEqual(['food'])
    expect(ctx.projects).toMatchObject([{ name: 'Japan', spentSoFar: 900 }])
    // individual expenses carry the note and who paid, by name
    expect(ctx.expenses[0]).toMatchObject({ note: 'Flights', who: 'Bubs' })
  })

  it('sends only the last three months of individual expenses', () => {
    const ctx = buildChatContext({
      ...base,
      categories: [cat('food')],
      expenses: [
        exp('food', 1, '2026-06-30'),
        exp('food', 2, '2026-07-01'),
        exp('food', 3, '2026-09-01'),
      ],
    }) as { expenses: { amount: number }[]; monthlyTotals: { byCategory: { amounts: number[] }[] } }
    expect(ctx.expenses.map((e) => e.amount)).toEqual([3, 2])
    // ...while the monthly totals still count June
    expect(ctx.monthlyTotals.byCategory[0].amounts.slice(-4)).toEqual([1, 2, 0, 3])
  })
})

describe('trimContext', () => {
  it('drops the oldest expenses first until it fits', () => {
    const expenses = Array.from({ length: 200 }, (_, i) => ({
      date: `d${i}`,
      note: 'x'.repeat(50),
    }))
    const trimmed = trimContext({ keep: 'this', expenses }, 5000) as {
      keep: string
      expenses: { date: string }[]
    }
    expect(JSON.stringify(trimmed).length).toBeLessThanOrEqual(5000)
    expect(trimmed.keep).toBe('this')
    expect(trimmed.expenses[0].date).toBe('d0')
  })
  it('leaves a small context alone', () => {
    const ctx = { a: 1, expenses: [1, 2] }
    expect(trimContext(ctx)).toEqual(ctx)
  })
})
