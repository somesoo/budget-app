import { describe, expect, it } from 'vitest'
import type { Allocation, Goal, SavingsAccount, SavingsMovement } from '../types'
import {
  accountGain,
  accountSummaries,
  balanceHistory,
  goalStatus,
  goalSummaries,
  goalUse,
  monthsBetween,
  projectBalance,
  savedInMonth,
  totalNeededPerMonth,
} from './savings'

const account = (id: string, rate: number | null = null): SavingsAccount => ({
  id,
  name: id,
  kind: 'savings',
  owner: 'joint',
  interest_rate: rate,
  color: '#3987e5',
  sort_order: 0,
  archived: false,
  note: null,
  created_at: '2026-01-01T00:00:00Z',
})

const goal = (id: string, target: number, target_date: string | null = null): Goal => ({
  id,
  name: id,
  target_amount: target,
  current_amount: 0,
  target_date,
  color: '#3987e5',
  sort_order: 0,
  archived: false,
  note: null,
  is_emergency: false,
  is_bills_fund: false,
})

let n = 0
const move = (
  account_id: string,
  amount: number,
  date: string,
  kind: SavingsMovement['kind'] = amount > 0 ? 'deposit' : 'withdrawal',
  goal_id: string | null = null,
): SavingsMovement => ({
  id: `m${n++}`,
  account_id,
  kind,
  amount,
  movement_date: date,
  person: null,
  note: null,
  goal_id,
  transfer_id: null,
  loan_id: null,
  expense_id: null,
  created_at: '2026-01-01T00:00:00Z',
})

const alloc = (account_id: string, goal_id: string, amount: number): Allocation => ({
  account_id,
  goal_id,
  amount,
})

describe('monthsBetween', () => {
  it('counts across a year end', () => {
    expect(monthsBetween('2026-09', '2027-04')).toBe(7)
    expect(monthsBetween('2026-09', '2026-09')).toBe(0)
    expect(monthsBetween('2026-09', '2026-06')).toBe(-3)
  })
})

describe('accountSummaries', () => {
  it('splits a balance into what goals hold and what is unassigned', () => {
    const [s] = accountSummaries(
      [account('a')],
      [
        move('a', 1000, '2026-08-01'),
        move('a', 12.5, '2026-08-31', 'interest'),
        move('a', -200, '2026-09-02'),
      ],
      [alloc('a', 'trip', 600)],
    )
    expect(s).toMatchObject({
      balance: 812.5,
      allocated: 600,
      unassigned: 212.5,
      byGoal: { trip: 600 },
    })
  })
})

describe('goalStatus', () => {
  const base = { saved: 2000, remaining: 4000, target: 6000, now: '2026-09' }
  it('is on track when the pace covers what is needed', () => {
    // 4000 over 8 months (to May 2027) is 500 a month
    expect(goalStatus({ ...base, pace: 500, targetDate: '2027-05-10' })).toEqual({
      kind: 'on-track',
      neededPerMonth: 500,
    })
  })
  it('is behind, with the shortfall at the date, when it does not', () => {
    expect(goalStatus({ ...base, pace: 300, targetDate: '2027-05-10' })).toEqual({
      kind: 'behind',
      neededPerMonth: 500,
      shortfall: 1600,
    })
  })
  it('estimates when an undated goal gets there, or says it is not moving', () => {
    expect(goalStatus({ ...base, pace: 1000, targetDate: null })).toEqual({
      kind: 'no-date',
      eta: '2027-01',
    })
    expect(goalStatus({ ...base, pace: 0, targetDate: null })).toEqual({
      kind: 'no-date',
      eta: null,
    })
  })
  it('knows reached, open-ended and overdue', () => {
    expect(goalStatus({ ...base, saved: 6000, remaining: 0, pace: 0, targetDate: null }).kind).toBe(
      'reached',
    )
    expect(goalStatus({ ...base, target: 0, pace: 0, targetDate: null }).kind).toBe('open')
    expect(goalStatus({ ...base, pace: 0, targetDate: '2026-09-30' })).toEqual({
      kind: 'overdue',
      shortfall: 4000,
    })
  })
})

describe('goalSummaries', () => {
  it('adds up a goal funded from two accounts and measures its pace', () => {
    const [s] = goalSummaries({
      goals: [goal('trip', 6000, '2027-05-01')],
      accounts: [account('a'), account('b')],
      movements: [
        move('a', 500, '2026-06-05', 'deposit', 'trip'),
        move('a', 500, '2026-07-05', 'deposit', 'trip'),
        move('b', 500, '2026-08-05', 'deposit', 'trip'),
        // this month's doesn't count toward the pace yet
        move('b', 500, '2026-09-05', 'deposit', 'trip'),
      ],
      allocations: [alloc('a', 'trip', 1000), alloc('b', 'trip', 1000)],
      now: '2026-09',
    })
    expect(s.saved).toBe(2000)
    expect(s.pace).toBe(500)
    expect(s.funding.map((f) => f.account.id)).toEqual(['a', 'b'])
    expect(s.status).toEqual({ kind: 'on-track', neededPerMonth: 500 })
    expect(totalNeededPerMonth([s])).toBe(500)
  })

  it('counts what was spent from a goal as put aside, though it left the account', () => {
    const spend = (account_id: string, amount: number, goal_id: string | null) => ({
      ...move(account_id, amount, '2026-09-12', 'spending', goal_id),
      expense_id: 'e1',
    })
    const [s] = goalSummaries({
      goals: [goal('trip', 5000, null)],
      accounts: [account('a')],
      movements: [
        move('a', 5000, '2026-06-05', 'deposit', 'trip'),
        spend('a', -3000, 'trip'),
        // taken from unassigned money once the goal ran out: not the goal's
        spend('a', -200, null),
      ],
      allocations: [alloc('a', 'trip', 2000)],
      now: '2026-09',
    })
    expect(s).toMatchObject({ saved: 2000, spent: 3000, putAside: 5000, remaining: 0 })
    expect(s.status).toEqual({ kind: 'reached' })
    // spending isn't saving less
    expect(savedInMonth([spend('a', -3000, 'trip')], '2026-09')).toBe(0)
    expect(goalUse(s.putAside, 3200)).toEqual({ left: 1800, share: 1800 / 5000 })
  })
})

describe('savedInMonth', () => {
  it('counts deposits and withdrawals, not interest, corrections or transfers', () => {
    const moves = [
      move('a', 1000, '2026-09-01'),
      move('a', -150, '2026-09-10'),
      move('a', 9, '2026-09-30', 'interest'),
      move('a', 40, '2026-09-15', 'adjustment'),
      move('a', -300, '2026-09-20', 'transfer'),
      move('b', 300, '2026-09-20', 'transfer'),
      move('a', 700, '2026-08-01'),
    ]
    expect(savedInMonth(moves, '2026-09')).toBe(850)
  })
})

describe('balanceHistory', () => {
  it('gives month-end balances and interest so far', () => {
    const moves = [
      move('a', 1000, '2026-07-03'),
      move('a', 5, '2026-07-31', 'interest'),
      move('a', 200, '2026-09-01'),
    ]
    expect(balanceHistory(moves, ['2026-06', '2026-07', '2026-08', '2026-09'])).toEqual([
      { month: '2026-06', balance: 0, interest: 0 },
      { month: '2026-07', balance: 1005, interest: 5 },
      { month: '2026-08', balance: 1005, interest: 5 },
      { month: '2026-09', balance: 1205, interest: 5 },
    ])
  })
})

describe('projectBalance', () => {
  it('compounds monthly on top of monthly deposits', () => {
    // 6% a year is 0.5% a month
    const [first, second] = projectBalance(1000, 6, 100, 2)
    expect(first).toBe(1105)
    expect(second).toBeCloseTo(1210.53, 1)
    expect(projectBalance(1000, null, 100, 2)).toEqual([1100, 1200])
  })
})

describe('accountGain', () => {
  it('tells what went in from what the money earned or lost', () => {
    const opening = { ...move('ike', 5_000, '2026-01-01', 'adjustment'), note: 'Opening balance' }
    const valued = { ...move('ike', 420, '2026-06-30', 'adjustment'), note: 'Balance updated' }
    const dip = { ...move('ike', -120, '2026-07-31', 'adjustment'), note: 'Balance updated' }
    const movements = [
      opening,
      move('ike', 1_000, '2026-02-10'),
      move('ike', 30, '2026-03-31', 'interest'),
      valued,
      dip,
    ]
    expect(accountGain(movements)).toEqual({ putIn: 6_000, gain: 330 })
  })
})

describe('goalUse', () => {
  it('leaves what was saved minus what was spent', () => {
    expect(goalUse(9000, 3000)).toEqual({ left: 6000, share: 6000 / 9000 })
  })
  it('goes negative when more was spent than saved', () => {
    expect(goalUse(3300, 3500)).toEqual({ left: -200, share: 0 })
  })
  it('has nothing to use from an empty goal', () => {
    expect(goalUse(0, 0)).toEqual({ left: 0, share: 0 })
  })
})
