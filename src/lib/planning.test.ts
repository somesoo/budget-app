import { describe, expect, it } from 'vitest'
import type { BudgetPlan } from '../types'
import { draftFrom, evenShares, splitLeftover, type PlanBaseline } from './planning'

const baseline: PlanBaseline = { months: [], categories: [], typicalIncome: null, incomeHistory: [] }

const plan = (p: Partial<BudgetPlan>): BudgetPlan => ({
  month: '2026-10',
  income: 10_000,
  savings: 1_500,
  limits: {},
  allocations: [],
  carryover: [],
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
        carryover: [{ goal_id: 'trip', account_id: 'gone', share: 100 }],
      }),
      keepExisting: (a) => a.account_id !== 'gone',
    })
    expect(draft.allocations).toEqual([{ goal_id: null, account_id: 'ike', amount: 1_000 }])
    // the deleted line's 300 is now "other savings"
    expect(draft.savings).toBe(1_500)
    expect(draft.carryover).toEqual([])
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
        carryover: [
          { goal_id: 'trip', account_id: 'acc', share: 60 },
          { goal_id: 'closed', account_id: 'acc', share: 40 },
        ],
      }),
      keepAllocation: (a) => a.goal_id !== 'closed',
    })
    expect(draft.allocations).toEqual([{ goal_id: 'trip', account_id: 'acc', amount: 500 }])
    // a closed goal's part goes to the goals still open
    expect(draft.carryover).toEqual([{ goal_id: 'trip', account_id: 'acc', share: 100 }])
  })
})

describe('splitting the leftover', () => {
  const c = (goal_id: string, share: number) => ({ goal_id, account_id: 'acc', share })

  it('evens shares out to whole percents adding up to 100', () => {
    expect(evenShares([c('a', 0), c('b', 0), c('c', 0)], true).map((x) => x.share)).toEqual([
      34, 33, 33,
    ])
    expect(evenShares([c('a', 62.5), c('b', 37.5)]).map((x) => x.share)).toEqual([63, 37])
  })

  it('splits whole złoty, the rounding going to the first goal', () => {
    expect(splitLeftover(1_000.8, [c('a', 34), c('b', 33), c('c', 33)])).toEqual([340, 330, 330])
    expect(splitLeftover(101, [c('a', 50), c('b', 50)])).toEqual([51, 50])
    expect(splitLeftover(500, [])).toEqual([])
  })
})
