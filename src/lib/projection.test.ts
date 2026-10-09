import { describe, expect, it } from 'vitest'
import type { Category, Expense } from '../types'
import { projectSpend } from './projection'

const cat = (id: string, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  color: '#3987e5',
  monthly_limit: 0,
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
const exp = (category_id: string, amount: number, expense_date: string): Expense => ({
  id: `${category_id}${amount}${expense_date}${Math.random()}`,
  amount,
  category_id,
  person: 'a',
  note: null,
  expense_date,
  created_at: '',
})

const categories = [
  cat('food', { spending_group: 'daily' }),
  cat('rent', { spending_group: 'bills' }),
  cat('ins', { spending_group: 'bills' }),
]
const none = new Set<string>()
// September has 30 days
const project = (expenses: Expense[], elapsed: number) =>
  projectSpend({ month: '2026-09', expenses, categories, billCategoryIds: none, elapsed })!

describe('projectSpend', () => {
  it('counts rent paid on the 1st once, not thirty times', () => {
    const p = project([exp('rent', 3000, '2026-09-01'), exp('food', 60, '2026-09-01')], 1)
    expect(p.fixed).toBe(3000)
    // no history: everyday at this month's own pace, 60 a day
    expect(p.total).toBe(3000 + 60 * 30)
  })

  it('expects rent that usually comes but has not yet', () => {
    const p = project(
      [
        exp('rent', 3000, '2026-08-01'),
        exp('rent', 3000, '2026-07-01'),
        exp('food', 50, '2026-09-02'),
      ],
      2,
    )
    expect(p.fixedToCome).toBe(3000)
    expect(p.fixed).toBe(3000)
  })

  it('does not spread a bill paid once a year over the months after', () => {
    const p = project([exp('ins', 1200, '2026-07-15'), exp('food', 10, '2026-08-15')], 5)
    expect(p.fixedToCome).toBe(0)
  })

  it('leans on the usual daily amount early, and on this month later', () => {
    // August (31 days): 31 a day of food
    const august = Array.from({ length: 31 }, (_, i) =>
      exp('food', 31, `2026-08-${String(i + 1).padStart(2, '0')}`),
    )
    // a big shop on the 1st: 300 on day one
    const early = project([...august, exp('food', 300, '2026-09-01')], 1)
    // perDay = 1/30 × 300 + 29/30 × 31
    expect(early.everyday).toBeCloseTo(300 + (300 / 30 + (29 / 30) * 31) * 29, 0)
    expect(early.everyday).toBeLessThan(300 * 30 / 4)
  })

  it('keeps a big one-off as it is', () => {
    const p = project([exp('food', 2000, '2026-09-02'), exp('food', 40, '2026-09-02')], 2)
    expect(p.oneOffs).toBe(2000)
    expect(p.total).toBe(2000 + 40 + 20 * 28)
  })

  it('has nothing to say before the month starts', () => {
    expect(
      projectSpend({ month: '2026-09', expenses: [], categories, billCategoryIds: none, elapsed: 0 }),
    ).toBeNull()
  })
})
