import { describe, expect, it } from 'vitest'
import { chapterSpans, currentChapter, historyFloor, summarizeChapter } from './chapters'

const together = { id: 'c2', name: 'Together', starts_on: '2026-09-01' }
const alone = { id: 'c1', name: 'Alone', starts_on: '2023-08-01' }

describe('chapters', () => {
  it('finds the chapter that has started last', () => {
    expect(currentChapter([together, alone], '2026-10-18')).toEqual(together)
    expect(currentChapter([together, alone], '2026-08-31')).toEqual(alone)
    expect(currentChapter([together], '2026-08-31')).toBeNull()
  })

  it('splits time into spans, newest first, with the time before the first', () => {
    expect(chapterSpans([together, alone])).toEqual([
      { id: 'c2', name: 'Together', from: '2026-09-01', to: null },
      { id: 'c1', name: 'Alone', from: '2023-08-01', to: '2026-08-31' },
      { id: null, name: null, from: null, to: '2023-07-31' },
    ])
    expect(chapterSpans([])).toEqual([])
  })

  it('starts history at the current chapter unless the past is included', () => {
    expect(historyFloor([together, alone], '2026-10-18', false)).toBe('2026-09-01')
    expect(historyFloor([together, alone], '2026-10-18', true)).toBeNull()
    expect(historyFloor([], '2026-10-18', false)).toBeNull()
  })
})

describe('summarizeChapter', () => {
  const e = (id: string, amount: number, date: string, category = 'food') => ({
    id,
    amount,
    expense_date: date,
    note: id,
    category_id: category,
  })

  it('adds up spending and income, measuring savings over months with income', () => {
    const s = summarizeChapter({
      expenses: [
        e('a', 1000, '2024-01-05'),
        e('b', 500, '2024-01-20', 'rent'),
        e('c', 2000, '2024-02-03', 'rent'),
        e('d', 800, '2024-04-10'),
      ],
      incomes: [
        { amount: 3000, income_date: '2024-02-01' },
        { amount: 3000, income_date: '2024-04-01' },
      ],
    })
    // March has nothing logged: a gap, not a month
    expect(s.months.map((m) => m.month)).toEqual(['2024-01', '2024-02', '2024-04'])
    expect(s.months[0].income).toBeNull()
    expect(s.spent).toBe(4300)
    expect(s.income).toBe(6000)
    expect(s.incomeMonths).toBe(2)
    expect(s.saved).toBe(3000 - 2000 + 3000 - 800)
    expect(s.savingsRate).toBeCloseTo(3200 / 6000)
    expect(s.averageSpent).toBe(1433.33)
    expect(s.biggestMonth?.month).toBe('2024-02')
    expect(s.byCategory.map((c) => c.categoryId)).toEqual(['rent', 'food'])
    expect(s.biggest[0]).toMatchObject({ id: 'c', amount: 2000 })
  })

  it("doesn't take a one-off alone for a month's income", () => {
    const s = summarizeChapter({
      expenses: [e('a', 3000, '2023-09-05'), e('b', 2000, '2023-10-05')],
      incomes: [
        { amount: 400, income_date: '2023-09-30', one_off: true },
        { amount: 5000, income_date: '2023-10-01' },
        { amount: 300, income_date: '2023-10-20', one_off: true },
      ],
    })
    expect(s.months.map((m) => m.income)).toEqual([null, 5300])
    expect(s.incomeMonths).toBe(1)
    expect(s.saved).toBe(3300)
  })

  it('splits the chapter into years from its first month', () => {
    const s = summarizeChapter({
      expenses: [e('a', 100, '2023-08-02'), e('b', 200, '2024-07-30'), e('c', 300, '2024-08-01')],
      incomes: [],
    })
    expect(s.years).toEqual([
      { label: '2023/24', from: '2023-08', to: '2024-07', spent: 300, months: 2 },
      { label: '2024/25', from: '2024-08', to: '2024-08', spent: 300, months: 1 },
    ])
    expect(s.savingsRate).toBeNull()
  })
})
