import { describe, expect, it } from 'vitest'
import type { Category, Expense } from '../types'
import { pacePoints, paceStatus, topCategories } from './insights'

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
const exp = (category_id: string, amount: number, expense_date: string): Expense => ({
  id: `${category_id}${amount}${expense_date}`,
  amount,
  category_id,
  person: 'a',
  note: null,
  expense_date,
  created_at: `${expense_date}T12:00:00Z`,
})

describe('paceStatus', () => {
  // 3000 over 30 days: 1000 by day 10
  it('is under pace more than 10% below', () => {
    expect(paceStatus(899, 3000, 10, 30)).toBe('under')
  })
  it('is on pace within ±10%', () => {
    expect(paceStatus(900, 3000, 10, 30)).toBe('on')
    expect(paceStatus(1000, 3000, 10, 30)).toBe('on')
    expect(paceStatus(1100, 3000, 10, 30)).toBe('on')
  })
  it('is over pace more than 10% above', () => {
    expect(paceStatus(1101, 3000, 10, 30)).toBe('over')
  })
  it('has nothing to say without a limit or before the month', () => {
    expect(paceStatus(100, 0, 10, 30)).toBeNull()
    expect(paceStatus(100, 3000, 0, 30)).toBeNull()
  })
})

describe('topCategories', () => {
  const cats = [cat('food'), cat('fun'), cat('car'), cat('gifts'), cat('rent', { show_in_chart: false })]

  it('ranks the month biggest first, with shares of what the chart counts', () => {
    const top = topCategories(
      [
        exp('food', 600, '2026-09-03'),
        exp('fun', 100, '2026-09-04'),
        exp('car', 300, '2026-09-05'),
        exp('gifts', 50, '2026-09-06'),
        exp('rent', 3000, '2026-09-01'),
      ],
      cats,
      '2026-09',
    )
    expect(top.map((r) => r.category.id)).toEqual(['food', 'car', 'fun'])
    expect(top[0].share).toBeCloseTo(600 / 1050)
  })

  it('averages typical over earlier months that have spending only', () => {
    const top = topCategories(
      [
        exp('food', 400, '2026-07-10'),
        exp('car', 100, '2026-08-10'),
        exp('food', 500, '2026-09-10'),
      ],
      cats,
      '2026-09',
    )
    // June has nothing at all: two months count, food is 400 and 0
    expect(top[0].typical).toBe(200)
  })

  it('has no typical without earlier months, and nothing for an empty month', () => {
    expect(topCategories([exp('food', 50, '2026-09-10')], cats, '2026-09')[0].typical).toBeNull()
    expect(topCategories([exp('food', 50, '2026-08-10')], cats, '2026-09')).toEqual([])
  })
})

describe('pacePoints', () => {
  it('starts the line at the fixed costs, the rest spread evenly', () => {
    const points = pacePoints([], '2025-04', 3000, 1500)
    expect(points[0].pace).toBe(1550)
    expect(points[14].pace).toBe(2250)
    expect(points[29].pace).toBe(3000)
  })

  it('spreads everything evenly without fixed costs', () => {
    const points = pacePoints([], '2025-04', 3000)
    expect(points[0].pace).toBe(100)
    expect(points[29].pace).toBe(3000)
  })
})
