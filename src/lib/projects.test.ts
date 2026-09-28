import { describe, expect, it } from 'vitest'
import type { Category, Expense } from '../types'
import { monthlyOnly, projectSummary } from './projects'

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
  ...extra,
})
const exp = (category_id: string, amount: number, date = '2026-09-10'): Expense => ({
  id: `${category_id}${amount}`,
  amount,
  category_id,
  person: 'bubs',
  note: null,
  expense_date: date,
  created_at: '2026-09-10T00:00:00Z',
})

const japan = cat('japan', {
  kind: 'project',
  budget_total: 12000,
  starts_on: '2027-04-01',
  ends_on: '2027-04-20',
})

describe('monthlyOnly', () => {
  it('leaves project spending out of the month', () => {
    const list = [exp('food', 100), exp('japan', 3000)]
    expect(monthlyOnly(list, [cat('food'), japan]).map((e) => e.category_id)).toEqual(['food'])
  })
})

describe('projectSummary', () => {
  const spend = [
    exp('japan', 3000, '2026-11-02'),
    exp('japan', 1200, '2027-04-03'),
    exp('food', 50),
  ]
  it('counts all its spending, whatever the month, against the budget', () => {
    expect(projectSummary(japan, spend, '2027-01-10')).toMatchObject({
      spent: 4200,
      left: 7800,
      phase: 'upcoming',
      days: 81,
    })
  })
  it('while running, says what is left per day, today included', () => {
    // 11 days to go (10th to 20th): 7800 / 11
    expect(projectSummary(japan, spend, '2027-04-10')).toMatchObject({
      phase: 'running',
      days: 11,
      perDayLeft: 709.09,
    })
  })
  it('knows finished and open-ended projects', () => {
    expect(projectSummary(japan, spend, '2027-05-01').phase).toBe('finished')
    expect(projectSummary(cat('reno', { kind: 'project' }), [], '2027-05-01')).toMatchObject({
      phase: 'open',
      budget: null,
      left: null,
    })
  })
})
