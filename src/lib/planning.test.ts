import { describe, expect, it } from 'vitest'
import type { BudgetPlan } from '../types'
import { draftFrom, type PlanBaseline } from './planning'

const baseline: PlanBaseline = { months: [], categories: [], typicalIncome: null, incomeHistory: [] }

const plan = (p: Partial<BudgetPlan>): BudgetPlan => ({
  month: '2026-10',
  income: 10_000,
  savings: 1_500,
  limits: {},
  allocations: [],
  carryover: null,
  note: null,
  updated_at: '2026-09-28T00:00:00Z',
  ...p,
})

describe('draftFrom', () => {
  it("drops a saved plan's lines to a deleted account, keeping the total", () => {
    const draft = draftFrom({
      source: 'defaults',
      categories: [],
      baseline,
      previousPlan: null,
      existing: plan({
        allocations: [
          { goal_id: null, account_id: 'ike', amount: 1_000 },
          { goal_id: null, account_id: 'gone', amount: 300 },
        ],
        carryover: { goal_id: 'trip', account_id: 'gone' },
      }),
      keepExisting: (a) => a.account_id !== 'gone',
    })
    expect(draft.allocations).toEqual([{ goal_id: null, account_id: 'ike', amount: 1_000 }])
    // the deleted line's 300 is now "other savings"
    expect(draft.savings).toBe(1_500)
    expect(draft.carryover).toBeNull()
  })

  it("carries last month's lines and leftover goal into a new plan", () => {
    const draft = draftFrom({
      source: 'previous',
      categories: [],
      baseline,
      previousPlan: plan({
        allocations: [
          { goal_id: 'trip', account_id: 'acc', amount: 500 },
          { goal_id: 'closed', account_id: 'acc', amount: 200 },
        ],
        carryover: { goal_id: 'trip', account_id: 'acc' },
      }),
      keepAllocation: (a) => a.goal_id !== 'closed',
    })
    expect(draft.allocations).toEqual([{ goal_id: 'trip', account_id: 'acc', amount: 500 }])
    expect(draft.carryover).toEqual({ goal_id: 'trip', account_id: 'acc' })
  })
})
