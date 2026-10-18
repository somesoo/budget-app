import { incomeMonth, roundMoney, shiftMonth, type MonthKey } from './calculations'
import type { Income, Person } from '../types'

/*
 * Money in over time: pay month by month, what came in on top of it, who
 * brought it in, and whether pay is going up. One-offs (a returned deposit,
 * something sold) are shown but kept apart, so they don't pass for a raise.
 */

export interface IncomeMonth {
  month: MonthKey
  /** Pay: everything that isn't a one-off. */
  pay: number
  oneOff: number
  /** Pay and one-offs, per person. */
  byPerson: Record<Person, number>
}

/** Every month from `from` to `to`, oldest first, the ones with nothing logged at zero. */
export function incomeByMonth(incomes: Income[], from: MonthKey, to: MonthKey): IncomeMonth[] {
  const rows = new Map<MonthKey, IncomeMonth>()
  for (let m = from; m <= to; m = shiftMonth(m, 1)) {
    rows.set(m, { month: m, pay: 0, oneOff: 0, byPerson: {} })
  }
  for (const i of incomes) {
    const row = rows.get(incomeMonth(i))
    if (!row) continue
    if (i.one_off) row.oneOff = roundMoney(row.oneOff + i.amount)
    else row.pay = roundMoney(row.pay + i.amount)
    row.byPerson[i.person] = roundMoney((row.byPerson[i.person] ?? 0) + i.amount)
  }
  return [...rows.values()]
}

export interface IncomeTrend {
  /** Average pay over the months with pay in the last twelve; null with none. */
  recent: number | null
  /** The same over the twelve before. */
  before: number | null
  /** recent vs before, as a fraction (0.15 = 15% more); null without both. */
  change: number | null
  /** The month with the most pay. */
  best: IncomeMonth | null
  /** Pay plus one-offs over all the months given. */
  total: number
  oneOffs: number
  /** Average pay over the months with pay. */
  average: number | null
  /** Months with pay logged. */
  paidMonths: number
}

const avgPay = (rows: IncomeMonth[]) => {
  const paid = rows.filter((r) => r.pay > 0)
  return paid.length ? roundMoney(paid.reduce((s, r) => s + r.pay, 0) / paid.length) : null
}

/**
 * Whether pay is going up: the average month with pay over the last twelve
 * against the twelve before. Months with no pay logged are left out of the
 * averages (pay that wasn't recorded isn't a month without pay).
 */
export function incomeTrend(rows: IncomeMonth[]): IncomeTrend {
  const last = rows.slice(-12)
  const prior = rows.slice(-24, -12)
  const recent = avgPay(last)
  const before = avgPay(prior)
  return {
    recent,
    before,
    change: recent !== null && before !== null && before > 0 ? (recent - before) / before : null,
    best: rows.reduce<IncomeMonth | null>(
      (top, r) => (r.pay > 0 && (top === null || r.pay > top.pay) ? r : top),
      null,
    ),
    total: roundMoney(rows.reduce((s, r) => s + r.pay + r.oneOff, 0)),
    oneOffs: roundMoney(rows.reduce((s, r) => s + r.oneOff, 0)),
    average: avgPay(rows),
    paidMonths: rows.filter((r) => r.pay > 0).length,
  }
}

/** Average pay a month per calendar year, oldest first; years with no pay logged left out. */
export function payByYear(rows: IncomeMonth[]): { year: string; average: number; months: number; total: number }[] {
  const years = new Map<string, IncomeMonth[]>()
  for (const r of rows) {
    if (r.pay <= 0) continue
    const y = r.month.slice(0, 4)
    years.set(y, [...(years.get(y) ?? []), r])
  }
  return [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, months]) => {
      const total = roundMoney(months.reduce((s, r) => s + r.pay, 0))
      return { year, total, months: months.length, average: roundMoney(total / months.length) }
    })
}

/** The first month anything was logged; null with nothing. */
export function firstIncomeMonth(incomes: Income[]): MonthKey | null {
  return incomes.reduce<MonthKey | null>((min, i) => {
    const m = incomeMonth(i)
    return min === null || m < min ? m : min
  }, null)
}
