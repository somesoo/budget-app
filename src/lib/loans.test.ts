import { describe, expect, it } from 'vitest'
import type { Goal, SavingsAccount, SavingsLoan, SavingsMovement } from '../types'
import {
  borrowSources,
  emptyAccountSteps,
  instalment,
  loanLines,
  loanSummaries,
  shareChanges,
} from './loans'
import type { AccountSummary, GoalSummary } from './savings'
import { allocationProgress } from './allocations'
import { draftFrom } from './planning'

const account = (id: string): SavingsAccount => ({
  id,
  name: id,
  kind: 'savings',
  owner: 'joint',
  interest_rate: null,
  color: '#3987e5',
  sort_order: 0,
  archived: false,
  note: null,
  created_at: '2026-01-01T00:00:00Z',
})

const summary = (id: string, balance: number, byGoal: Record<string, number>): AccountSummary => {
  const allocated = Object.values(byGoal).reduce((s, v) => s + v, 0)
  return { account: account(id), balance, allocated, unassigned: balance - allocated, byGoal }
}

const goal = (id: string, status: GoalSummary['status'], date: string | null, remaining = 0) =>
  ({
    goal: {
      id,
      name: id,
      target_amount: date ? 10_000 : 0,
      current_amount: 0,
      target_date: date,
      color: '#3987e5',
      sort_order: 0,
      archived: false,
      note: null,
    } satisfies Goal,
    saved: 0,
    remaining,
    progress: null,
    funding: [],
    pace: 0,
    status,
  }) as GoalSummary

const loan = (p: Partial<SavingsLoan> = {}): SavingsLoan => ({
  id: 'loan',
  account_id: 'acc',
  goal_id: 'trip',
  amount: 1_200,
  monthly: 400,
  note: 'car repair',
  created_at: '2026-09-01T00:00:00Z',
  ...p,
})

let n = 0
const deposit = (amount: number, date: string, loan_id: string | null = null): SavingsMovement => ({
  id: `m${n++}`,
  account_id: 'acc',
  kind: 'deposit',
  amount,
  movement_date: date,
  person: null,
  note: null,
  goal_id: 'trip',
  transfer_id: null,
  loan_id,
  created_at: '2026-01-01T00:00:00Z',
})

describe('loans', () => {
  it('knows what is left to pay back, and the next instalment', () => {
    const [l] = loanSummaries([loan()], [deposit(400, '2026-10-02', 'loan'), deposit(1_000, '2026-10-03')])
    expect(l).toMatchObject({ repaid: 400, remaining: 800, nextInstalment: 400 })
    const [last] = loanSummaries([loan()], [deposit(1_000, '2026-10-02', 'loan')])
    expect(last.nextInstalment).toBe(200)
  })

  it('splits a loan into round instalments', () => {
    expect(instalment(1_000, 3)).toBe(340)
    expect(instalment(95, 12)).toBe(10)
    expect(instalment(5, 3)).toBe(5)
  })

  it('puts open loans in a new plan, instead of last month’s instalments', () => {
    const loans = loanSummaries([loan(), loan({ id: 'paid', amount: 100 })], [
      deposit(100, '2026-09-20', 'paid'),
    ])
    const draft = draftFrom({
      source: 'previous',
      categories: [],
      baseline: { months: [], categories: [], typicalIncome: null, incomeHistory: [] },
      previousPlan: {
        month: '2026-09',
        income: 10_000,
        savings: 2_100,
        limits: {},
        allocations: [
          { goal_id: 'trip', account_id: 'acc', amount: 1_000 },
          { goal_id: 'trip', account_id: 'acc', amount: 100, loan_id: 'paid' },
        ],
        carryover: [],
        note: null,
        updated_at: '',
      },
      instalments: loanLines(loans),
    })
    expect(draft.allocations).toEqual([
      { goal_id: 'trip', account_id: 'acc', amount: 1_000 },
      { goal_id: 'trip', account_id: 'acc', amount: 400, loan_id: 'loan' },
    ])
    expect(draft.savings).toBe(2_400)
  })

  it('counts an instalment apart from the goal’s own line', () => {
    const [own, back] = allocationProgress(
      [
        { goal_id: 'trip', account_id: 'acc', amount: 500 },
        { goal_id: 'trip', account_id: 'acc', amount: 400, loan_id: 'loan' },
      ],
      [deposit(500, '2026-10-02'), deposit(400, '2026-10-02', 'loan')],
      '2026-10',
    )
    expect(own.paid).toBe(500)
    expect(back.paid).toBe(400)
  })
})

describe('borrowSources', () => {
  it('suggests unassigned money, then no deadline, then the furthest deadline', () => {
    const goals = [
      goal('soon', { kind: 'on-track', neededPerMonth: 500 }, '2026-12-01', 1_500),
      goal('later', { kind: 'on-track', neededPerMonth: 100 }, '2027-09-01', 1_200),
      goal('fund', { kind: 'open' }, null),
    ]
    const accounts = [summary('acc', 5_000, { soon: 1_000, later: 1_000, fund: 1_000 })]
    const order = borrowSources(accounts, goals, 800).map((s) => s.goal?.goal.id ?? 'free')
    expect(order).toEqual(['free', 'fund', 'later', 'soon'])
  })

  it('says what a dated goal would need a month afterwards', () => {
    const goals = [goal('later', { kind: 'on-track', neededPerMonth: 100 }, '2027-09-01', 1_200)]
    const [s] = borrowSources([summary('acc', 1_000, { later: 1_000 })], goals, 600)
    // 1,200 left over 12 months; 600 more makes it 1,800
    expect(s.neededAfter).toBe(150)
  })

  it('puts sources that can’t cover it all last', () => {
    const goals = [goal('fund', { kind: 'open' }, null)]
    const accounts = [summary('small', 100, {}), summary('big', 2_000, { fund: 2_000 })]
    expect(borrowSources(accounts, goals, 500).map((s) => s.account.id)).toEqual(['big', 'small'])
  })
})

describe('moving and correcting', () => {
  it('empties an account goal by goal, then what is unassigned', () => {
    expect(emptyAccountSteps(summary('acc', 1_500, { trip: 1_000 }))).toEqual([
      { goalId: 'trip', amount: 1_000 },
      { goalId: null, amount: 500 },
    ])
    expect(emptyAccountSteps(summary('acc', 0, {}))).toEqual([])
  })

  it('fixes shares with the decreases first, and never past the balance', () => {
    const s = summary('acc', 1_000, { trip: 800, car: 200 })
    expect(shareChanges(s, { trip: 300, car: 200, home: 500 })).toEqual([
      { goalId: 'trip', delta: -500 },
      { goalId: 'home', delta: 500 },
    ])
    expect(() => shareChanges(s, { trip: 900, car: 200 })).toThrow(/only has 1000/)
  })
})
