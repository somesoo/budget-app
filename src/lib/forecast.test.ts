import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAdviceRequest } from '../../api/advice'
import type { Category, Expense, Goal } from '../types'
import { buildAdviceRequest, monthForecast } from './forecast'
import { goalSummaries, accountSummaries } from './savings'
import { projectSummary } from './projects'

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
  ...extra,
})
const exp = (
  category_id: string,
  amount: number,
  date: string,
  note: string | null = null,
): Expense => ({
  id: `${category_id}${amount}${date}`,
  amount,
  category_id,
  person: 'meow',
  note,
  expense_date: date,
  created_at: `${date}T10:00:00Z`,
})
const goal: Goal = {
  id: 'g1',
  name: 'Japan 2027',
  target_amount: 12000,
  current_amount: 0,
  target_date: '2027-04-01',
  color: '#ec4899',
  sort_order: 0,
  archived: false,
  note: null,
  is_emergency: false,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 20, 12))
})
afterEach(() => vi.useRealTimers())

describe('buildAdviceRequest', () => {
  it('builds what /api/advice accepts, savings and projects included', () => {
    const categories = [cat('food'), cat('fun')]
    const expenses = [
      exp('food', 120, '2026-09-03', 'Lidl'),
      exp('fun', 300, '2026-09-10', 'Concert'),
      exp('food', 90, '2026-08-03'),
    ]
    const forecast = monthForecast({
      month: '2026-09',
      isCurrent: true,
      expenses,
      incomes: [],
      goal,
    })
    const account = {
      id: 'a1',
      name: 'Revolut',
      kind: 'savings' as const,
      owner: 'joint' as const,
      interest_rate: 5.5,
      color: '#3987e5',
      sort_order: 0,
      archived: false,
      note: null,
      created_at: '2026-01-01',
    }
    const allocations = [{ account_id: 'a1', goal_id: 'g1', amount: 4000 }]
    const movements = [
      {
        id: 'm1',
        account_id: 'a1',
        kind: 'deposit' as const,
        amount: 4000,
        movement_date: '2026-07-01',
        person: null,
        note: null,
        goal_id: 'g1',
        transfer_id: null,
        loan_id: null,
        created_at: '2026-07-01',
      },
    ]
    const request = buildAdviceRequest({
      month: '2026-09',
      expenses,
      categories,
      goal,
      forecast,
      alerts: [],
      savings: {
        available: true,
        savedThisMonth: 0,
        plannedThisMonth: null,
        total: 4000,
        unassigned: 0,
        accounts: accountSummaries([account], movements, allocations),
        goals: goalSummaries({
          goals: [goal],
          accounts: [account],
          movements,
          allocations,
          now: '2026-09',
        }),
      },
      projects: [projectSummary(cat('trip', { kind: 'project', budget_total: 9000 }), [])],
    })
    expect(isAdviceRequest(request)).toBe(true)
    expect(request.biggestExpenses[0]).toMatchObject({ amount: 300, note: 'Concert', who: 'Meow' })
    expect(request.savings?.goals[0]).toMatchObject({
      name: 'Japan 2027',
      saved: 4000,
      onTrack: true,
    })
  })

  it('is still accepted without savings accounts', () => {
    const forecast = monthForecast({
      month: '2026-09',
      isCurrent: true,
      expenses: [],
      incomes: [],
      goal: null,
    })
    const request = buildAdviceRequest({
      month: '2026-09',
      expenses: [],
      categories: [cat('food')],
      goal: null,
      forecast,
    })
    expect(request.savings).toBeNull()
    expect(isAdviceRequest(request)).toBe(true)
  })
})
