import type { Category, Expense, Person } from '../types'
import {
  daysInMonth,
  monthKeyOfDate,
  monthRange,
  roundMoney,
  shiftMonth,
  todayKey,
  type MonthKey,
} from './calculations'

/* Pure aggregations behind the Insights tab. Everything takes the raw expense
   list for a window of months and derives what one chart needs. */

/** `count` months ending at `month`, oldest first. */
export function monthsEndingAt(month: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - (count - 1)))
}

/** Date range covering a list of months, both ends inclusive. */
export function windowRange(months: MonthKey[]): { from: string; to: string } {
  return { from: monthRange(months[0]).from, to: monthRange(months[months.length - 1]).to }
}

/**
 * How far into `month` we are: the full month for a past one, today's day for
 * the current one, zero for a future one.
 */
export function elapsedDays(month: MonthKey): number {
  const today = todayKey()
  const current = monthKeyOfDate(today)
  if (month < current) return daysInMonth(month)
  if (month > current) return 0
  return Number(today.slice(-2))
}

/* ---------- pace: cumulative spend vs an even spread of the limit ---------- */

export interface PacePoint {
  day: number
  /** Spent up to and including this day; null for days that haven't happened yet. */
  cumulative: number | null
  /** Where you'd be spending the monthly limit evenly. */
  pace: number
}

export function pacePoints(expenses: Expense[], month: MonthKey, totalLimit: number): PacePoint[] {
  const days = daysInMonth(month)
  const elapsed = elapsedDays(month)
  const perDay = new Array<number>(days + 1).fill(0)
  for (const e of expenses) {
    if (monthKeyOfDate(e.expense_date) === month) {
      perDay[Number(e.expense_date.slice(-2))] += e.amount
    }
  }

  const points: PacePoint[] = []
  let running = 0
  for (let day = 1; day <= days; day++) {
    running += perDay[day]
    points.push({
      day,
      cumulative: day <= elapsed ? roundMoney(running) : null,
      pace: roundMoney((totalLimit * day) / days),
    })
  }
  return points
}

/** Straight-line projection of the month's total from the days elapsed so far. */
export function projectMonthEnd(spent: number, month: MonthKey): number | null {
  const elapsed = elapsedDays(month)
  if (elapsed === 0) return null
  return roundMoney((spent / elapsed) * daysInMonth(month))
}

/**
 * Drop the empty months at the start of the window — the months before you
 * started logging. Zeros there aren't "we spent nothing", they're "no data",
 * and plotting them would drag every trend down to a false baseline.
 */
export function trimLeadingEmpty(expenses: Expense[], months: MonthKey[]): MonthKey[] {
  const used = new Set(expenses.map((e) => monthKeyOfDate(e.expense_date)))
  const first = months.findIndex((m) => used.has(m))
  return first === -1 ? [] : months.slice(first)
}

/* ---------- month over month ---------- */

export function monthlyTotals(expenses: Expense[], months: MonthKey[]) {
  const totals = new Map(months.map((m) => [m, 0]))
  for (const e of expenses) {
    const m = monthKeyOfDate(e.expense_date)
    if (totals.has(m)) totals.set(m, totals.get(m)! + e.amount)
  }
  return months.map((month) => ({ month, total: roundMoney(totals.get(month)!) }))
}

export interface CategoryDelta {
  category: Category
  current: number
  previous: number
  delta: number
}

/**
 * Per-category change vs the previous month, biggest swings first.
 *
 * `dayCutoff` makes it like-for-like while a month is still running: on the
 * 21st, compare 1–21 of this month with 1–21 of last month. Otherwise 21 days
 * would be measured against 31 and nearly every category would look "down".
 */
export function categoryDeltas(
  expenses: Expense[],
  categories: Category[],
  month: MonthKey,
  dayCutoff?: number,
): CategoryDelta[] {
  const previousMonth = shiftMonth(month, -1)
  const current = new Map<string, number>()
  const previous = new Map<string, number>()
  for (const e of expenses) {
    if (dayCutoff !== undefined && Number(e.expense_date.slice(-2)) > dayCutoff) continue
    const m = monthKeyOfDate(e.expense_date)
    const bucket = m === month ? current : m === previousMonth ? previous : null
    if (bucket) bucket.set(e.category_id, (bucket.get(e.category_id) ?? 0) + e.amount)
  }

  return categories
    .map((category) => {
      const cur = roundMoney(current.get(category.id) ?? 0)
      const prev = roundMoney(previous.get(category.id) ?? 0)
      return { category, current: cur, previous: prev, delta: roundMoney(cur - prev) }
    })
    .filter((d) => d.current > 0 || d.previous > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

/* ---------- who spent what, over time ---------- */

export type PersonMonth = { month: MonthKey } & Record<Person, number>

export function personByMonth(expenses: Expense[], months: MonthKey[]): PersonMonth[] {
  const rows = new Map<MonthKey, PersonMonth>(
    months.map((month) => [month, { month, bubs: 0, meow: 0 }]),
  )
  for (const e of expenses) {
    const row = rows.get(monthKeyOfDate(e.expense_date))
    if (row) row[e.person] = roundMoney(row[e.person] + e.amount)
  }
  return months.map((m) => rows.get(m)!)
}

/* ---------- weekday habits ---------- */

/**
 * Average spend per weekday (Monday = 0): the total spent on all Mondays
 * divided by how many Mondays there were. Days without spending count, so a
 * weekday you rarely spend on reads low — but counting starts at the first
 * logged expense, so months before you used the app don't dilute everything.
 */
export function weekdayAverages(expenses: Expense[], months: MonthKey[]) {
  const totals = new Array<number>(7).fill(0)
  const occurrences = new Array<number>(7).fill(0)
  const today = todayKey()
  const firstLogged = expenses.reduce<string | null>(
    (min, e) => (min === null || e.expense_date < min ? e.expense_date : min),
    null,
  )
  if (!firstLogged) return totals.map((_, weekday) => ({ weekday, average: 0 }))

  for (const month of months) {
    const [y, m] = month.split('-').map(Number)
    for (let d = 1; d <= daysInMonth(month); d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`
      if (key > today) break
      if (key < firstLogged) continue
      occurrences[(new Date(y, m - 1, d).getDay() + 6) % 7]++
    }
  }

  for (const e of expenses) {
    const [y, m, d] = e.expense_date.split('-').map(Number)
    totals[(new Date(y, m - 1, d).getDay() + 6) % 7] += e.amount
  }

  return totals.map((total, weekday) => ({
    weekday,
    average: occurrences[weekday] ? roundMoney(total / occurrences[weekday]) : 0,
  }))
}

/* ---------- axis helpers ---------- */

/** A "nice" axis maximum and step: 0 / 500 / 1,000 / 1,500 rather than 0 / 437 / 874. */
export function niceScale(max: number, targetTicks = 4): { max: number; step: number } {
  if (max <= 0) return { max: 100, step: 25 }
  const rough = max / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const residual = rough / magnitude
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10
  const step = nice * magnitude
  return { max: Math.ceil(max / step) * step, step }
}

/** Compact axis labels: 950 → "950", 12,400 → "12.4k". */
export function compactAmount(value: number): string {
  if (Math.abs(value) >= 1000) {
    const k = value / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return String(Math.round(value))
}
