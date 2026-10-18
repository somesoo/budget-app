import { describe, expect, it } from 'vitest'
import type { Income } from '../types'
import { firstIncomeMonth, incomeByMonth, incomeTrend, payByYear } from './income'

const inc = (amount: number, date: string, person = 'bubs', one_off = false, for_month: string | null = null): Income => ({
  id: `${date}-${amount}-${person}`,
  amount,
  person,
  note: null,
  income_date: date,
  for_month,
  one_off,
  created_at: `${date}T08:00:00Z`,
})

describe('incomeByMonth', () => {
  it('fills every month, keeps one-offs apart and splits by person', () => {
    const rows = incomeByMonth(
      [
        inc(5000, '2025-01-01'),
        inc(1400, '2025-01-10', 'meow'),
        inc(300, '2025-01-20', 'bubs', true),
        // late pay for the month after counts there
        inc(5000, '2025-02-27', 'bubs', false, '2025-03'),
      ],
      '2025-01',
      '2025-03',
    )
    expect(rows.map((r) => r.month)).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(rows[0]).toEqual({ month: '2025-01', pay: 6400, oneOff: 300, byPerson: { bubs: 5300, meow: 1400 } })
    expect(rows[1].pay).toBe(0)
    expect(rows[2].pay).toBe(5000)
  })
})

describe('incomeTrend', () => {
  it('compares the last twelve months of pay with the twelve before', () => {
    const incomes = [
      ...Array.from({ length: 12 }, (_, i) => inc(5000, `2024-${String(i + 1).padStart(2, '0')}-01`)),
      ...Array.from({ length: 11 }, (_, i) => inc(6000, `2025-${String(i + 1).padStart(2, '0')}-01`)),
      inc(800, '2025-12-15', 'bubs', true),
    ]
    const trend = incomeTrend(incomeByMonth(incomes, '2024-01', '2025-12'))
    // December 2025 has only a one-off: not a month of pay, not averaged in
    expect(trend.recent).toBe(6000)
    expect(trend.before).toBe(5000)
    expect(trend.change).toBeCloseTo(0.2)
    expect(trend.oneOffs).toBe(800)
    expect(trend.paidMonths).toBe(23)
    expect(trend.best?.pay).toBe(6000)
  })

  it('has no change without a year before', () => {
    const trend = incomeTrend(incomeByMonth([inc(5000, '2025-01-01')], '2025-01', '2025-03'))
    expect(trend.change).toBeNull()
    expect(trend.average).toBe(5000)
  })
})

describe('payByYear', () => {
  it('averages the months with pay per calendar year', () => {
    const rows = incomeByMonth(
      [inc(5000, '2024-11-01'), inc(5400, '2024-12-01'), inc(6000, '2025-01-01')],
      '2024-10',
      '2025-02',
    )
    expect(payByYear(rows)).toEqual([
      { year: '2024', total: 10400, months: 2, average: 5200 },
      { year: '2025', total: 6000, months: 1, average: 6000 },
    ])
    expect(firstIncomeMonth([inc(1, '2025-03-01'), inc(1, '2024-11-05')])).toBe('2024-11')
  })
})
