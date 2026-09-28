import { describe, expect, it } from 'vitest'
import type { SavingsAccount, SavingsMovement } from '../types'
import {
  allocationProgress,
  carryAllocations,
  contributedInYear,
  leftoverNote,
  leftoverPaid,
  monthLeftover,
  otherSavings,
  retirementLimit,
  retirementStatus,
  safeToSpend,
  setAllocation,
} from './allocations'

const ike: SavingsAccount & { kind: 'ike' } = {
  id: 'ike',
  name: 'IKE Bubs',
  kind: 'ike',
  owner: 'bubs',
  interest_rate: null,
  color: '#3987e5',
  sort_order: 0,
  archived: false,
  note: null,
  created_at: '2026-01-01T00:00:00Z',
}

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
  transfer_id: kind === 'transfer' ? 't' : null,
  created_at: '2026-01-01T00:00:00Z',
})

describe('safe to spend', () => {
  it('takes the planned savings off the income, then the spending', () => {
    expect(safeToSpend({ income: 12_000, plannedIncome: 11_000, savings: 3_000, spent: 9_284 }))
      .toEqual({ amount: -284, income: 12_000, expected: false })
  })

  it('counts on the planned income until a paycheck is logged', () => {
    expect(safeToSpend({ income: 0, plannedIncome: 11_000, savings: 3_000, spent: 500 })).toEqual({
      amount: 7_500,
      income: 11_000,
      expected: true,
    })
    expect(safeToSpend({ income: 0, plannedIncome: 0, savings: 0, spent: 500 })).toBeNull()
  })

  it('has no leftover without income', () => {
    expect(monthLeftover({ income: 0, savings: 0, spent: 100 })).toBeNull()
    expect(monthLeftover({ income: 10_000, savings: 2_000, spent: 7_500 })).toBe(500)
  })
})

describe('setAllocation', () => {
  it('keeps other savings where it was', () => {
    const start = { savings: 1000, allocations: [] }
    const a = setAllocation(start, { goal_id: 'trip', account_id: 'acc' }, 300)
    expect(a.savings).toBe(1300)
    expect(otherSavings(a.savings, a.allocations)).toBe(1000)

    const b = setAllocation(a, { goal_id: null, account_id: 'ike' }, 500)
    expect(b.savings).toBe(1800)

    // changing a line replaces it, zero removes it
    const c = setAllocation(b, { goal_id: 'trip', account_id: 'acc' }, 100)
    expect(c.allocations).toHaveLength(2)
    expect(c.savings).toBe(1600)
    const d = setAllocation(c, { goal_id: 'trip', account_id: 'acc' }, 0)
    expect(d.allocations).toEqual([{ goal_id: null, account_id: 'ike', amount: 500 }])
    expect(d.savings).toBe(1500)
  })
})

describe('carryAllocations', () => {
  it('drops lines of closed goals and accounts', () => {
    const lines = [
      { goal_id: 'open', account_id: 'acc', amount: 100 },
      { goal_id: 'closed', account_id: 'acc', amount: 100 },
      { goal_id: null, account_id: 'ike', amount: 100 },
      { goal_id: null, account_id: 'gone', amount: 100 },
      { goal_id: 'open', account_id: null, amount: 50 },
    ]
    expect(carryAllocations(lines, new Set(['open']), new Set(['acc', 'ike']))).toEqual([
      lines[0],
      lines[2],
      lines[4],
    ])
  })
})

describe('IKE limit', () => {
  it('falls back to the latest known year', () => {
    expect(retirementLimit('ike', 2026)).toEqual({ amount: 28_260, year: 2026 })
    expect(retirementLimit('ike', 2031).year).toBe(2026)
  })

  it('counts deposits and transfers in, not interest or withdrawals', () => {
    const movements = [
      move('ike', 5000, '2026-02-10'),
      move('ike', 1000, '2026-03-10', 'transfer'),
      move('ike', 300, '2026-03-31', 'interest'),
      move('ike', -2000, '2026-04-02'),
      move('ike', 9000, '2025-12-20'),
      move('other', 700, '2026-05-01'),
    ]
    expect(contributedInYear(movements, 'ike', 2026)).toBe(6000)
    expect(contributedInYear(movements, 'ike', 2026, '2026-03')).toBe(5000)
  })

  it('suggests what uses up the limit by December', () => {
    const movements = [move('ike', 12_000, '2026-03-01'), move('ike', 1_000, '2026-10-05')]
    const s = retirementStatus(ike, movements, '2026-10')
    expect(s.contributed).toBe(12_000)
    expect(s.thisMonth).toBe(1_000)
    expect(s.room).toBe(16_260)
    expect(s.monthsLeft).toBe(3)
    expect(s.toMaxOut).toBe(5_420)
  })

  it('suggests nothing once the limit is reached', () => {
    const s = retirementStatus(ike, [move('ike', 30_000, '2026-01-05')], '2026-06')
    expect(s.room).toBe(0)
    expect(s.toMaxOut).toBe(0)
  })
})

describe('allocationProgress', () => {
  it('matches goal lines by goal and account lines by account', () => {
    const lines = [
      { goal_id: 'trip', account_id: 'acc', amount: 500 },
      { goal_id: null, account_id: 'ike', amount: 1000 },
    ]
    const movements = [
      move('acc', 200, '2026-09-03', 'deposit', 'trip'),
      move('other', 300, '2026-09-04', 'deposit', 'trip'),
      move('ike', 400, '2026-09-05', 'transfer'),
      move('ike', 600, '2026-09-06'),
      // another month, and a goal's money moved around, don't count
      move('acc', 500, '2026-08-30', 'deposit', 'trip'),
      move('acc', 250, '2026-09-10', 'transfer', 'trip'),
    ]
    const [trip, pension] = allocationProgress(lines, movements, '2026-09')
    expect(trip.paid).toBe(500)
    expect(trip.remaining).toBe(0)
    expect(pension.paid).toBe(1000)
    expect(pension.remaining).toBe(0)
  })

  it('leaves a leftover deposit to its own line', () => {
    const note = leftoverNote('September')
    const movements = [
      { ...move('acc', 800, '2026-10-02', 'deposit', 'trip'), note },
      move('acc', 100, '2026-10-03', 'deposit', 'trip'),
    ]
    const [trip] = allocationProgress(
      [{ goal_id: 'trip', account_id: 'acc', amount: 500 }],
      movements,
      '2026-10',
    )
    expect(trip.paid).toBe(100)
    expect(leftoverPaid(movements, 'trip', note)).toBe(800)
  })

  it('leaves the rest to pay', () => {
    const [line] = allocationProgress(
      [{ goal_id: null, account_id: 'ike', amount: 1000 }],
      [move('ike', 250, '2026-09-01')],
      '2026-09',
    )
    expect(line.remaining).toBe(750)
  })
})
