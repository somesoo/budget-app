import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category, Expense } from '../types'
import { alertSubject, budgetAlerts, crossingNote, limitImpact, limitLevel } from './alerts'

const cat = (id: string, limit: number, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  color: '#3987e5',
  monthly_limit: limit,
  sort_order: 0,
  archived: false,
  show_in_chart: true,
  kind: 'monthly',
  budget_total: null,
  starts_on: null,
  ends_on: null,
  goal_id: null,
  owner: null,
  ...extra,
})

let n = 0
const exp = (category_id: string, amount: number, day: number, month = '2026-09'): Expense => ({
  id: `e${n++}`,
  amount,
  category_id,
  person: 'bubs',
  note: null,
  expense_date: `${month}-${String(day).padStart(2, '0')}`,
  created_at: '2026-09-01T00:00:00Z',
})

/** `count` equal expenses adding up to `total`, on the first days of the month. */
const spread = (id: string, total: number, count: number) =>
  Array.from({ length: count }, (_, i) => exp(id, total / count, i + 1))

const at = (day: number) => vi.setSystemTime(new Date(2026, 8, day, 12))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('limitLevel', () => {
  it('is ok below 80%, near from 80%, over only above the limit', () => {
    expect(limitLevel(79, 100)).toBe('ok')
    expect(limitLevel(80, 100)).toBe('near')
    expect(limitLevel(100, 100)).toBe('near')
    expect(limitLevel(100.01, 100)).toBe('over')
  })
  it('never warns without a limit', () => {
    expect(limitLevel(500, 0)).toBe('ok')
  })
})

describe('budgetAlerts', () => {
  const run = (expenses: Expense[], categories: Category[]) =>
    budgetAlerts({ month: '2026-09', expenses, categories })

  it('flags a category at 85% as near and one at 110% as over, over first', () => {
    at(28)
    const alerts = run([exp('a', 85, 27), exp('b', 110, 27)], [cat('a', 100), cat('b', 100)])
    // 195 of 200 overall: close, but the budget as a whole only warns once over or heading over
    expect(alerts.map((a) => a.id)).toEqual(['2026-09:b:over', '2026-09:a:near'])
  })

  it('warns about the pace once there is a week of data and enough expenses', () => {
    at(10)
    // 200 in 10 days of a 30-day month projects to 600, against 300
    const alerts = run(spread('a', 200, 5), [cat('a', 300)])
    expect(alerts.find((a) => a.category?.id === 'a')?.kind).toBe('pace')
  })

  it('stays quiet about pace in the first week', () => {
    at(5)
    expect(run(spread('a', 100, 5), [cat('a', 300)])).toEqual([])
  })

  it("stays quiet about a category's pace with only a couple of expenses", () => {
    at(10)
    const alerts = run(spread('a', 200, 2), [cat('a', 300)])
    expect(alerts.filter((a) => a.category)).toEqual([])
  })

  it('never projects a fixed cost paid in one go', () => {
    at(10)
    const rent = cat('rent', 3200, { show_in_chart: false })
    const alerts = run([exp('rent', 3200, 1)], [rent, cat('food', 2000)])
    // rent paid in full is at its limit by design; neither it nor the month is "heading over"
    expect(alerts).toEqual([])
  })

  it('still warns when a fixed cost goes over', () => {
    at(10)
    const rent = cat('rent', 3200, { show_in_chart: false })
    expect(run([exp('rent', 3300, 1)], [rent]).map((a) => a.id)).toEqual([
      '2026-09:rent:over',
      '2026-09:total:over',
    ])
  })

  it('ignores hidden categories with nothing spent and categories without a limit', () => {
    at(20)
    const alerts = run([exp('free', 999, 3)], [cat('old', 100, { archived: true }), cat('free', 0)])
    expect(alerts).toEqual([])
  })

  it('says how much a day still fits', () => {
    at(10)
    const alert = run(spread('a', 200, 5), [cat('a', 300)]).find((a) => a.category)!
    expect(alert.kind).toBe('pace')
    // 100 left for the 21 days to go, today included
    expect(alert.detail).toContain('Up to 4 zł a day for 21 days')
  })
})

describe('alertSubject', () => {
  it('drops the kind, so warnings about one thing can be matched up', () => {
    expect(alertSubject({ id: '2026-09:abc:over' })).toBe('2026-09:abc')
  })
})

describe('crossingNote', () => {
  const c = cat('Fun', 300)
  it('speaks up when an expense crosses into near or over', () => {
    expect(crossingNote(c, limitImpact(200, 50, 300))).toBe('Fun is now at 83% of its limit')
    expect(crossingNote(c, limitImpact(280, 60, 300))).toBe('Fun is now 40 zł over its limit')
  })
  it('stays quiet when nothing changed', () => {
    expect(crossingNote(c, limitImpact(10, 20, 300))).toBeNull()
    expect(crossingNote(c, limitImpact(310, 20, 300))).toBeNull()
  })
})
