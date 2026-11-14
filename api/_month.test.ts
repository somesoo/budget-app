import { describe, expect, it } from 'vitest'
import {
  checkExpense,
  isDay,
  isMonth,
  level,
  monthRange,
  monthStatus,
  monthSummary,
  sameExpense,
  todayIn,
  type CategoryRow,
  type ExpenseRow,
} from './_month'
import { hashToken, newToken, TOKEN_PREFIX } from './_tokens'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const cat = (n: number, limit: number, extra: Partial<CategoryRow> = {}): CategoryRow => ({
  id: id(n),
  name: `cat${n}`,
  color: '#3987e5',
  monthly_limit: limit,
  sort_order: n,
  archived: false,
  kind: 'monthly',
  owner: null,
  ...extra,
})

let seq = 0
const exp = (category: number, amount: number | string, day: string, extra: Partial<ExpenseRow> = {}): ExpenseRow => ({
  id: id(1000 + seq++),
  amount,
  category_id: id(category),
  person: 'anna',
  expense_date: day,
  created_at: `${day}T12:00:00Z`,
  ...extra,
})

describe('dates', () => {
  it('knows a month and a real day', () => {
    expect(isMonth('2026-11')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-1')).toBe(false)
    expect(isMonth(['2026-11'])).toBe(false)
    expect(isDay('2026-02-28')).toBe(true)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('2026-11-13T00:00')).toBe(false)
  })

  it('counts a month by the calendar', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28', days: 28 })
    expect(monthRange('2028-02').days).toBe(29)
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31', days: 31 })
  })

  it("takes today from the budget's timezone, not UTC", () => {
    expect(todayIn('Europe/Warsaw', new Date('2026-11-13T22:59:00Z'))).toBe('2026-11-13')
    expect(todayIn('Europe/Warsaw', new Date('2026-11-13T23:00:00Z'))).toBe('2026-11-14')
    expect(todayIn('Europe/Warsaw', new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01')
  })
})

describe('month status', () => {
  const categories = [
    cat(1, 1000),
    cat(2, 500),
    cat(3, 0),
    cat(4, 300, { archived: true }),
    cat(5, 200, { archived: true }),
    cat(6, 0, { kind: 'project' }),
  ]

  it('adds in grosze and uses the same near and over lines as the app', () => {
    expect(level(79_99, 100_00)).toBe('ok')
    expect(level(80_00, 100_00)).toBe('near')
    expect(level(100_00, 100_00)).toBe('near')
    expect(level(100_01, 100_00)).toBe('over')
    expect(level(50_00, 0)).toBe('ok')
    const status = monthStatus(
      categories,
      [exp(1, 0.1, '2026-11-02'), exp(1, 0.2, '2026-11-03'), exp(1, '799.70', '2026-11-04')],
      null,
    )
    expect(status[0]).toMatchObject({ spent: 800, remaining: 200, level: 'near' })
  })

  it("prefers the month's plan, keeps archived categories only when spent in, and leaves projects out", () => {
    const status = monthStatus(
      categories,
      [exp(2, 450, '2026-11-02'), exp(4, 10, '2026-11-02'), exp(6, 999, '2026-11-05')],
      { income: 0, savings: 0, limits: { [id(2)]: 400, [id(3)]: '50.50' } },
    )
    expect(status.map((c) => c.name)).toEqual(['cat1', 'cat2', 'cat3', 'cat4'])
    expect(status[1]).toMatchObject({ limit: 400, spent: 450, remaining: -50, level: 'over' })
    expect(status[2]).toMatchObject({ limit: 50.5, spent: 0, level: 'ok' })
    expect(status[3]).toMatchObject({ archived: true, limit: 300, spent: 10 })
  })
})

describe('month summary', () => {
  const categories = [cat(1, 1000), cat(2, 500), cat(4, 300, { archived: true }), cat(6, 0, { kind: 'project' })]
  const expenses = [
    exp(1, 100.05, '2026-11-02'),
    exp(2, 480, '2026-11-10', { created_at: '2026-11-10T08:00:00Z' }),
    exp(2, 30, '2026-11-10', { created_at: '2026-11-10T19:00:00Z' }),
    exp(4, 9.95, '2026-11-03'),
    exp(6, 2000, '2026-11-12'),
  ]
  const summary = (today: string, budget = null as null | { income: number; savings: number; limits: object }) =>
    monthSummary({
      month: '2026-11',
      today,
      categories,
      expenses,
      incomes: [{ amount: 5000 }, { amount: '1234.56' }],
      budget: budget as never,
    })

  it('keeps projects out of the month and archived limits out of the total', () => {
    const s = summary('2026-11-13')
    expect(s.spending).toEqual({ spent: 620, limit: 1500, remaining: 880, projects: 2000 })
    expect(s.income).toEqual({ received: 6234.56, planned: null })
    expect(s.expenses).toBe(4)
    expect(s.categories).toEqual({ over: 1, near: 0 })
    expect(s.has_plan).toBe(false)
    expect(s.savings_planned).toBeNull()
  })

  it('names the last expense by day, then by when it was added, without its note', () => {
    expect(summary('2026-11-13').last_expense).toEqual({ date: '2026-11-10', amount: 30, category: 'cat2' })
    expect(monthSummary({ month: '2026-11', today: '2026-11-13', categories, expenses: [], incomes: [], budget: null }).last_expense).toBeNull()
  })

  it('counts the days left for a running, past and coming month', () => {
    expect(summary('2026-11-13').days_left).toBe(17)
    expect(summary('2026-11-30').days_left).toBe(0)
    expect(summary('2026-12-05').days_left).toBe(0)
    expect(summary('2026-10-20').days_left).toBe(30)
  })

  it('reports the plan when the month has one', () => {
    const s = summary('2026-11-13', { income: 7000, savings: 1500.5, limits: { [id(1)]: 90 } })
    expect(s.has_plan).toBe(true)
    expect(s.income.planned).toBe(7000)
    expect(s.savings_planned).toBe(1500.5)
    expect(s.spending.limit).toBe(590)
    expect(s.categories.over).toBe(2)
  })
})

describe('an expense from another app', () => {
  const ctx = {
    today: '2026-11-13',
    categories: [
      cat(1, 1000),
      cat(2, 100, { owner: 'lukasz' }),
      cat(3, 100, { archived: true }),
      cat(4, 0, { kind: 'project' }),
    ],
    people: ['anna', 'lukasz'],
    tokenPerson: null as string | null,
  }
  const ok = { amount: 23.5, category_id: id(1), person: 'anna' }
  const error = (body: unknown, extra = {}) => {
    const result = checkExpense(body, { ...ctx, ...extra })
    return result.ok ? null : result.error
  }

  it('fills in today and trims the note', () => {
    expect(checkExpense({ ...ok, note: '  bread  ' }, ctx)).toEqual({
      ok: true,
      expense: { amount: 23.5, category_id: id(1), person: 'anna', note: 'bread', expense_date: '2026-11-13' },
    })
    expect(checkExpense({ ...ok, note: '   ', date: '2026-10-13' }, ctx)).toMatchObject({
      expense: { note: null, expense_date: '2026-10-13' },
    })
  })

  it('refuses amounts that are not money', () => {
    for (const amount of [0, -1, 0.001, 10.005, 1e12, Number.NaN, Infinity, '12', null, undefined]) {
      expect(error({ ...ok, amount }), String(amount)).toBe('invalid_amount')
    }
    expect(error({ ...ok, amount: 0.01 })).toBeNull()
    expect(error({ ...ok, amount: 99_999_999.99 })).toBeNull()
    expect(error({ ...ok, amount: 0.1 + 0.2 })).toBeNull()
  })

  it('takes only an active monthly category that exists', () => {
    for (const category_id of [id(3), id(4), id(99), 'food', "1' or '1'='1", undefined]) {
      expect(error({ ...ok, category_id }), String(category_id)).toBe('invalid_category')
    }
  })

  it("keeps a person's key and an allowance to that person", () => {
    expect(error({ ...ok, person: 'nobody' })).toBe('invalid_person')
    expect(error({ amount: 5, category_id: id(1) })).toBe('invalid_person')
    expect(error({ amount: 5, category_id: id(1) }, { tokenPerson: 'anna' })).toBeNull()
    expect(error({ ...ok, person: 'lukasz' }, { tokenPerson: 'anna' })).toBe('person_not_allowed')
    expect(error({ ...ok, category_id: id(2) })).toBe('person_not_allowed')
    expect(error({ ...ok, category_id: id(2), person: 'lukasz' })).toBeNull()
    // a key whose person has since been removed adds nothing
    expect(error({ amount: 5, category_id: id(1) }, { tokenPerson: 'gone' })).toBe('invalid_person')
  })

  it('dates within the last 31 days and never ahead', () => {
    expect(error({ ...ok, date: '2026-11-14' })).toBe('invalid_date')
    expect(error({ ...ok, date: '2026-10-13' })).toBeNull()
    expect(error({ ...ok, date: '2026-10-12' })).toBe('invalid_date')
    expect(error({ ...ok, date: '2026-02-30' })).toBe('invalid_date')
    expect(error({ ...ok, date: 20261113 })).toBe('invalid_date')
  })

  it('refuses anything it does not know', () => {
    expect(error({ ...ok, id: id(5) })).toBe('unknown_field')
    expect(error({ ...ok, created_at: '2020-01-01' })).toBe('unknown_field')
    expect(error({ ...ok, note: 'x'.repeat(201) })).toBe('invalid_note')
    expect(error({ ...ok, note: 5 })).toBe('invalid_note')
    for (const body of [null, 'text', [ok], 5]) expect(error(body)).toBe('invalid_body')
  })

  it('recognises a repeat of the same request and a reused key', () => {
    const wanted = { amount: 23.5, category_id: id(1), person: 'anna', note: null, expense_date: '2026-11-13' }
    expect(sameExpense({ ...wanted, amount: '23.50' }, wanted)).toBe(true)
    expect(sameExpense({ ...wanted, amount: 23.51 }, wanted)).toBe(false)
    expect(sameExpense({ ...wanted, note: 'x' }, wanted)).toBe(false)
    expect(sameExpense({ ...wanted, person: 'lukasz' }, wanted)).toBe(false)
  })
})

describe('keys', () => {
  it('are long, random and stored only as a hash', () => {
    const a = newToken()
    const b = newToken()
    expect(a).not.toBe(b)
    expect(a.startsWith(TOKEN_PREFIX)).toBe(true)
    expect(a.length).toBeGreaterThanOrEqual(47)
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).not.toContain(a.slice(4, 12))
  })
})
