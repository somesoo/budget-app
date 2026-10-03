import { describe, expect, it } from 'vitest'
import type { DebtBalance } from '../types'
import {
  afterInstalment,
  balanceAtMonthEnd,
  currentBalance,
  payoff,
  payoffPlan,
  separatePayoff,
} from './debts'

const bal = (debt_id: string, balance_date: string, balance: number, created = '00'): DebtBalance => ({
  id: `${debt_id}-${balance_date}-${created}`,
  debt_id,
  balance_date,
  balance,
  note: null,
  created_at: `${balance_date}T10:${created}:00Z`,
})

describe('balances', () => {
  const list = [
    bal('car', '2026-01-10', 20000),
    bal('car', '2026-03-10', 18000),
    bal('car', '2026-03-10', 17900, '30'),
    bal('flat', '2026-02-01', 300000),
  ]

  it('takes the latest balance, the later entry on the same day winning', () => {
    expect(currentBalance(list, 'car')).toBe(17900)
    expect(currentBalance(list, 'none')).toBe(0)
  })

  it('knows what was owed at a month end, 0 before the first balance', () => {
    const car = list.filter((b) => b.debt_id === 'car')
    expect(balanceAtMonthEnd(car, '2025-12')).toBe(0)
    expect(balanceAtMonthEnd(car, '2026-02')).toBe(20000)
    expect(balanceAtMonthEnd(car, '2026-03')).toBe(17900)
  })
})

describe('afterInstalment', () => {
  it('adds the month interest, then takes the payment off', () => {
    // 12% a year is 1% a month: 10 000 + 100 − 500
    expect(afterInstalment(10000, 12, 500)).toBe(9600)
    expect(afterInstalment(300, 12, 500)).toBe(0)
    expect(afterInstalment(1000, null, 100)).toBe(900)
  })
})

describe('payoff', () => {
  it('without interest is balance / payment, rounded up', () => {
    expect(payoff(1000, 0, 300, '2026-10')).toEqual({ months: 4, month: '2027-02', interest: 0 })
  })

  it('with interest takes longer and says how much interest', () => {
    const p = payoff(10000, 12, 500, '2026-10')
    expect(p.months).toBe(23)
    expect(p.interest).toBeGreaterThan(1000)
    expect(p.interest).toBeLessThan(1300)
  })

  it('never ends when the payment does not cover the interest', () => {
    expect(payoff(10000, 12, 100, '2026-10').months).toBeNull()
    expect(payoff(10000, 12, 0, '2026-10').month).toBeNull()
  })
})

describe('payoffPlan', () => {
  const debts = [
    { id: 'card', balance: 3000, ratePct: 24, payment: 150 },
    { id: 'car', balance: 1500, ratePct: 8, payment: 100 },
    { id: 'phone', balance: 2000, ratePct: 0, payment: 100 },
  ]

  it('snowball goes smallest first, avalanche dearest first', () => {
    expect(payoffPlan(debts, 200, 'snowball', '2026-10').order).toEqual(['car', 'phone', 'card'])
    expect(payoffPlan(debts, 200, 'avalanche', '2026-10').order).toEqual(['card', 'car', 'phone'])
  })

  it('avalanche pays the least interest, snowball clears the first debt sooner', () => {
    const snow = payoffPlan(debts, 200, 'snowball', '2026-10')
    const aval = payoffPlan(debts, 200, 'avalanche', '2026-10')
    expect(aval.interest).toBeLessThanOrEqual(snow.interest)
    expect(snow.byDebt.car.months!).toBeLessThan(aval.byDebt.car.months!)
  })

  it('extra money and rolling payments over beat paying each on its own', () => {
    const alone = separatePayoff(debts, '2026-10')
    const plan = payoffPlan(debts, 200, 'avalanche', '2026-10')
    expect(plan.months!).toBeLessThan(alone.months!)
    expect(plan.interest).toBeLessThan(alone.interest)
  })

  it('rolls a paid-off debt’s payment over even without extra', () => {
    const plan = payoffPlan(debts, 0, 'snowball', '2026-10')
    const alone = separatePayoff(debts, '2026-10')
    expect(plan.months!).toBeLessThan(alone.months!)
  })

  it('a debt with nothing owed is done from the start, and an empty plan is done', () => {
    const plan = payoffPlan([{ id: 'x', balance: 0, ratePct: 5, payment: 10 }], 0, 'snowball', '2026-10')
    expect(plan.months).toBe(0)
    expect(plan.byDebt.x.months).toBe(0)
  })
})
