import { describe, expect, it } from 'vitest'
import type { Debt, DebtBalance, SavingsMovement } from '../types'
import { ageOfMoney, averageSaving, independence, netWorthHistory } from './wealth'

const move = (date: string, amount: number, kind: SavingsMovement['kind'] = 'deposit'): SavingsMovement => ({
  id: `${date}${amount}`,
  account_id: 'a',
  kind,
  amount,
  movement_date: date,
  person: null,
  note: null,
  goal_id: null,
  transfer_id: null,
  loan_id: null,
  expense_id: null,
  created_at: `${date}T10:00:00Z`,
})

const debt: Debt = {
  id: 'car',
  name: 'Car',
  kind: 'loan',
  owner: 'joint',
  interest_rate: 8,
  monthly_payment: 500,
  color: '#d95926',
  sort_order: 0,
  archived: false,
  note: null,
  created_at: '2026-01-01T00:00:00Z',
}
const bal = (balance_date: string, balance: number): DebtBalance => ({
  id: balance_date,
  debt_id: 'car',
  balance_date,
  balance,
  note: null,
  created_at: `${balance_date}T10:00:00Z`,
})

describe('netWorthHistory', () => {
  it('is savings minus what was owed at each month end', () => {
    const points = netWorthHistory({
      months: ['2026-01', '2026-02', '2026-03'],
      movements: [move('2026-01-05', 5000), move('2026-03-05', 1000)],
      debts: [debt],
      balances: [bal('2026-02-10', 10000), bal('2026-03-10', 9600)],
    })
    expect(points.map((p) => p.net)).toEqual([5000, -5000, -3600])
    expect(points[2]).toMatchObject({ assets: 6000, debts: 9600 })
  })
})

describe('ageOfMoney', () => {
  it('is how long money waited, first in first out', () => {
    // pay on the 1st, spent on the 11th and the 21st: 10 and 20 days
    expect(
      ageOfMoney({
        incomes: [{ amount: 1000, income_date: '2026-09-01' }],
        expenses: [
          { amount: 500, expense_date: '2026-09-11' },
          { amount: 500, expense_date: '2026-09-21' },
        ],
        savedAside: [],
      }),
    ).toBe(15)
  })

  it('spends the oldest money first, and counts savings as going out', () => {
    const age = ageOfMoney({
      incomes: [
        { amount: 1000, income_date: '2026-08-01' },
        { amount: 1000, income_date: '2026-09-01' },
      ],
      expenses: [{ amount: 500, expense_date: '2026-09-10' }],
      savedAside: [{ amount: 500, date: '2026-09-10' }],
    })
    // both paid from August's pay: 40 days
    expect(age).toBe(40)
  })

  it('skips money spent before any income was logged, null with nothing to date', () => {
    expect(
      ageOfMoney({
        incomes: [{ amount: 100, income_date: '2026-09-15' }],
        expenses: [{ amount: 50, expense_date: '2026-09-01' }],
        savedAside: [],
      }),
    ).toBeNull()
  })
})

describe('independence', () => {
  it('needs 25 years of spending and says how far along it is', () => {
    const fi = independence({ monthlySpending: 5000, have: 150000, monthlySaving: 0, multiple: 25, realReturn: 0 })!
    expect(fi.target).toBe(1_500_000)
    expect(fi.progress).toBeCloseTo(0.1)
    expect(fi.years).toBeNull()
  })

  it('works out the years from saving and returns', () => {
    const plain = independence({ monthlySpending: 1000, have: 0, monthlySaving: 1000, multiple: 25, realReturn: 0 })!
    expect(plain.years).toBe(25)
    const growing = independence({ monthlySpending: 1000, have: 0, monthlySaving: 1000, multiple: 25, realReturn: 0.04 })!
    expect(growing.years!).toBeLessThan(25)
  })

  it('is reached when there is enough, and unknown without spending', () => {
    expect(independence({ monthlySpending: 100, have: 30000, monthlySaving: 0, multiple: 25, realReturn: 0 })!.years).toBe(0)
    expect(independence({ monthlySpending: 0, have: 1, monthlySaving: 1, multiple: 25, realReturn: 0 })).toBeNull()
  })
})

describe('averageSaving', () => {
  it('averages deposits less withdrawals, leaving out interest and corrections', () => {
    const moves = [
      move('2026-08-02', 1000),
      move('2026-09-02', 600),
      move('2026-09-20', -200, 'withdrawal'),
      move('2026-09-30', 50, 'interest'),
      move('2026-07-01', 9999),
    ]
    expect(averageSaving(moves, ['2026-08', '2026-09'])).toBe(700)
  })
})
