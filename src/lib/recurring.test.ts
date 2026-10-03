import { describe, expect, it } from 'vitest'
import type { RecurringCost } from '../types'
import {
  addMonths,
  dueForReview,
  dueSoon,
  fundShouldHold,
  nextDue,
  regularTotals,
} from './recurring'

const cost = (over: Partial<RecurringCost>): RecurringCost => ({
  id: over.name ?? 'x',
  name: 'x',
  kind: 'bill',
  amount: 100,
  every_months: 1,
  due_on: '2026-01-10',
  category_id: null,
  owner: null,
  archived: false,
  reviewed_on: null,
  note: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('dates', () => {
  it('adds months, keeping the day or the month’s last one', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-03-10', -12)).toBe('2025-03-10')
  })

  it('finds the next due date from a past one, today included', () => {
    const oc = cost({ every_months: 12, due_on: '2025-03-15' })
    expect(nextDue(oc, '2026-10-03')).toBe('2027-03-15')
    expect(nextDue(cost({ due_on: '2026-01-10' }), '2026-10-10')).toBe('2026-10-10')
  })

  it('from a date set cycles ahead, still finds the nearest one', () => {
    expect(nextDue(cost({ every_months: 3, due_on: '2027-06-01' }), '2026-10-03')).toBe('2026-12-01')
  })
})

describe('totals', () => {
  const costs = [
    cost({ name: 'netflix', kind: 'subscription', amount: 60 }),
    cost({ name: 'oc', amount: 1200, every_months: 12 }),
    cost({ name: 'water', amount: 300, every_months: 3 }),
    cost({ name: 'old', amount: 999, archived: true }),
  ]

  it('spreads every cost per month and per year, the rare ones apart', () => {
    expect(regularTotals(costs)).toEqual({ monthly: 260, yearly: 3120, setAside: 200 })
  })

  it('lists what is due soon, soonest first', () => {
    const soon = dueSoon(costs, '2026-10-03', 10)
    // both due on the 10th; the bigger one first
    expect(soon.map((s) => s.cost.name)).toEqual(['water', 'netflix'])
    expect(soon[0]).toMatchObject({ due: '2026-10-10', inDays: 7 })
  })
})

describe('fundShouldHold', () => {
  it('holds the part of each rare bill’s cycle already gone by', () => {
    // due 2027-01-01 yearly: on 2026-10-01, 9 of 12 months are gone
    const oc = cost({ amount: 1200, every_months: 12, due_on: '2027-01-01' })
    expect(fundShouldHold([oc], '2026-10-01')).toBeCloseTo(900, -1)
    // all of it on the day, next to nothing the day after
    expect(fundShouldHold([oc], '2027-01-01')).toBe(1200)
    expect(fundShouldHold([oc], '2027-01-02')).toBeLessThan(10)
  })

  it('leaves monthly costs out', () => {
    expect(fundShouldHold([cost({ amount: 50 })], '2026-10-05')).toBe(0)
  })
})

describe('dueForReview', () => {
  it('asks about subscriptions not checked for three months', () => {
    const fresh = cost({ name: 'a', kind: 'subscription', reviewed_on: '2026-09-01' })
    const stale = cost({ name: 'b', kind: 'subscription', reviewed_on: '2026-05-01' })
    const never = cost({ name: 'c', kind: 'subscription', created_at: '2026-01-01T00:00:00Z' })
    const bill = cost({ name: 'd' })
    expect(dueForReview([fresh, stale, never, bill], '2026-10-03').map((c) => c.name)).toEqual(['b', 'c'])
  })
})
