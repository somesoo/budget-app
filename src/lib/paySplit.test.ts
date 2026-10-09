import { describe, expect, it } from 'vitest'
import type { Category, Expense, Income, SavingsAccount, SavingsMovement } from '../types'
import { guessGroup, paySplit } from './paySplit'

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
  spending_group: null,
  ...extra,
})
const exp = (category_id: string, amount: number, expense_date: string): Expense => ({
  id: `${category_id}${amount}${expense_date}`,
  amount,
  category_id,
  person: 'a',
  note: null,
  expense_date,
  created_at: `${expense_date}T12:00:00Z`,
})
const pay = (amount: number, income_date: string, for_month: string | null = null): Income =>
  ({ id: `${amount}${income_date}`, amount, person: 'a', note: null, income_date, for_month, one_off: false, created_at: '' }) as Income
const account = (id: string, kind: SavingsAccount['kind']): SavingsAccount => ({
  id,
  name: id,
  kind,
  owner: 'joint',
  interest_rate: null,
  color: '#000',
  sort_order: 0,
  archived: false,
  note: null,
  created_at: '',
})
const move = (
  account_id: string,
  kind: SavingsMovement['kind'],
  amount: number,
  movement_date: string,
): SavingsMovement => ({
  id: `${account_id}${kind}${amount}${movement_date}`,
  account_id,
  kind,
  amount,
  movement_date,
  person: null,
  note: null,
  goal_id: null,
  transfer_id: null,
  loan_id: null,
  expense_id: null,
  created_at: '',
})

describe('guessGroup', () => {
  const none = new Set<string>()
  it('reads Polish and English names', () => {
    expect(guessGroup(cat('c', { name: 'Rata kredytu' }), none)).toBe('debts')
    expect(guessGroup(cat('c', { name: 'Jedzenie' }), none)).toBe('daily')
    expect(guessGroup(cat('c', { name: 'Restauracje' }), none)).toBe('fun')
    expect(guessGroup(cat('c', { name: 'Internet' }), none)).toBe('bills')
    expect(guessGroup(cat('c', { name: 'Prezenty' }), none)).toBe('other')
  })
  it('takes rent-like categories as bills', () => {
    expect(guessGroup(cat('c', { name: 'Mieszkanie', show_in_chart: false }), none)).toBe('bills')
    expect(guessGroup(cat('c', { name: 'Netflix' }), new Set(['c']))).toBe('bills')
  })
})

describe('paySplit', () => {
  const categories = [
    cat('food', { name: 'Jedzenie' }),
    cat('rent', { name: 'Czynsz' }),
    cat('loan', { name: 'Rata', spending_group: 'debts' }),
    cat('gifts', { name: 'Prezenty', spending_group: 'fun' }),
  ]
  const accounts = [account('acc', 'savings'), account('ike', 'ike')]
  const base = {
    month: '2026-09',
    categories,
    accounts,
    billCategoryIds: new Set<string>(),
  }

  it('splits the month into groups, savings and investments, and what is left', () => {
    const s = paySplit({
      ...base,
      incomes: [pay(8000, '2026-09-10'), pay(500, '2026-08-28', '2026-09'), pay(9000, '2026-10-10')],
      expenses: [
        exp('food', 1200, '2026-09-03'),
        exp('food', 300, '2026-09-20'),
        exp('rent', 2500, '2026-09-01'),
        exp('loan', 900, '2026-09-05'),
        exp('gifts', 100, '2026-09-06'),
        exp('food', 999, '2026-08-30'),
      ],
      movements: [
        move('acc', 'deposit', 1000, '2026-09-11'),
        move('ike', 'deposit', 700, '2026-09-11'),
        move('acc', 'interest', 50, '2026-09-30'),
        move('acc', 'transfer', -300, '2026-09-15'),
      ],
    })
    expect(s.income).toBe(8500)
    expect(s.parts.map((p) => [p.id, p.amount])).toEqual([
      ['daily', 1500],
      ['bills', 2500],
      ['debts', 900],
      ['fun', 100],
      ['savings', 1000],
      ['investments', 700],
    ])
    expect(s.left).toBe(8500 - 1500 - 2500 - 900 - 100 - 1000 - 700)
    expect(s.guessed).toBe(true)
  })

  it('goes below zero when it ran short, and counts money taken out of savings', () => {
    const s = paySplit({
      ...base,
      incomes: [pay(3000, '2026-09-10')],
      expenses: [exp('rent', 2500, '2026-09-01'), exp('food', 1750, '2026-09-02')],
      movements: [move('acc', 'withdrawal', -500, '2026-09-20')],
    })
    expect(s.fromSavings).toBe(500)
    expect(s.parts.some((p) => p.id === 'savings')).toBe(false)
    expect(s.left).toBe(-750)
  })
})
