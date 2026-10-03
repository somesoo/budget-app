import type { RecurringCost } from '../types'
import { roundMoney } from './calculations'

/*
 * Regular costs: subscriptions and bills that come back every 1, 2, 3, 6 or
 * 12 months. A monthly one is part of every month's spending; the rarer ones
 * (car insurance, a yearly subscription) are what catches a budget out, so
 * the app spreads them: put a twelfth of a yearly bill aside every month, and
 * it's there when the bill comes.
 */

/** A subscription not checked for this long is up for review. */
export const REVIEW_AFTER_MONTHS = 3

/** Whether it's paid less often than monthly, so worth saving up for. */
export const isRare = (c: Pick<RecurringCost, 'every_months'>) => c.every_months > 1

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return { y, m, d }
}

/** `key` moved by whole months, the day kept (or the month's last day when shorter). */
export function addMonths(key: string, months: number): string {
  const { y, m, d } = parse(key)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** The next date it's due, today or later. */
export function nextDue(c: Pick<RecurringCost, 'due_on' | 'every_months'>, today: string): string {
  let due = c.due_on
  // forward from a past date…
  let k = 0
  while (due < today) due = addMonths(c.due_on, ++k * c.every_months)
  // …or back from a far-off one, so a date set a cycle ahead still shows the next one
  while (k <= 0) {
    const earlier = addMonths(c.due_on, (k - 1) * c.every_months)
    if (earlier < today) break
    due = earlier
    k--
  }
  return due
}

/** Whole days from `today` to `key`. */
export function daysUntil(key: string, today: string): number {
  return Math.round(
    (Date.parse(`${key}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000,
  )
}

/** What it costs a month, spread evenly. */
export const perMonth = (c: Pick<RecurringCost, 'amount' | 'every_months'>) =>
  c.amount / c.every_months

/** What it costs a year. */
export const perYear = (c: Pick<RecurringCost, 'amount' | 'every_months'>) =>
  (c.amount * 12) / c.every_months

export interface RegularTotals {
  /** Every cost spread per month. */
  monthly: number
  yearly: number
  /** Of `monthly`, the rarer ones: what a bills fund should get each month. */
  setAside: number
}

export function regularTotals(costs: RecurringCost[]): RegularTotals {
  const open = costs.filter((c) => !c.archived)
  return {
    monthly: roundMoney(open.reduce((s, c) => s + perMonth(c), 0)),
    yearly: roundMoney(open.reduce((s, c) => s + perYear(c), 0)),
    setAside: roundMoney(open.filter(isRare).reduce((s, c) => s + perMonth(c), 0)),
  }
}

/** The ones due within `days`, soonest first, with their date. */
export function dueSoon(
  costs: RecurringCost[],
  today: string,
  days: number,
): { cost: RecurringCost; due: string; inDays: number }[] {
  return costs
    .filter((c) => !c.archived)
    .map((cost) => {
      const due = nextDue(cost, today)
      return { cost, due, inDays: daysUntil(due, today) }
    })
    .filter((x) => x.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays || b.cost.amount - a.cost.amount)
}

/**
 * What a bills fund should hold today to pay every rare bill on time from
 * steady monthly amounts: for each, the part of its cycle already gone by.
 * A yearly 1 200 zł bill due in 3 months should have 900 zł waiting.
 */
export function fundShouldHold(costs: RecurringCost[], today: string): number {
  let total = 0
  for (const c of costs) {
    if (c.archived || !isRare(c)) continue
    const due = nextDue(c, today)
    const cycle = daysUntil(due, addMonths(due, -c.every_months))
    const gone = 1 - daysUntil(due, today) / cycle
    total += c.amount * Math.min(1, Math.max(0, gone))
  }
  return roundMoney(total)
}

/** Subscriptions not checked within REVIEW_AFTER_MONTHS (or ever, past their first cycle). */
export function dueForReview(costs: RecurringCost[], today: string): RecurringCost[] {
  const cutoff = addMonths(today, -REVIEW_AFTER_MONTHS)
  return costs.filter(
    (c) =>
      !c.archived &&
      c.kind === 'subscription' &&
      (c.reviewed_on ?? c.created_at.slice(0, 10)) <= cutoff,
  )
}
