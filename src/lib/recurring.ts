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

/* ---------- paying them ---------- */

/** Due within this many days, a cost can be marked paid ahead of time. */
export const PAY_AHEAD_DAYS = 14
/** A due date passed this many days ago still asks to be marked paid. */
export const PAY_LATE_DAYS = 14

/** The last date it was due, today included. */
export function lastDue(c: Pick<RecurringCost, 'due_on' | 'every_months'>, today: string): string {
  const { y: ay, m: am } = parse(c.due_on)
  const { y: by, m: bm } = parse(today)
  // every due date is due_on moved by whole cycles; start near today and step back
  const k = Math.floor(((by - ay) * 12 + (bm - am)) / c.every_months) + 1
  for (let i = k; ; i--) {
    const due = addMonths(c.due_on, i * c.every_months)
    if (due <= today) return due
  }
}

/** A payment that's been logged: which cost, and which due date it paid. */
export interface PaidDue {
  recurring_id: string
  recurring_due: string
}

export type PayState =
  /** Logged for the current due date. */
  | { kind: 'paid'; due: string }
  /** Due (or recently overdue) and not logged yet. */
  | { kind: 'due'; due: string }
  /** Coming up soon; can be paid ahead. */
  | { kind: 'soon'; due: string }
  /** Nothing to do now. */
  | { kind: 'none' }

/**
 * Where a cost stands for paying: the due date that just passed (up to
 * PAY_LATE_DAYS back) if it hasn't been logged, then the next one if it's
 * within PAY_AHEAD_DAYS. A date from before the cost was added never counts.
 */
export function payState(
  c: Pick<RecurringCost, 'id' | 'due_on' | 'every_months' | 'created_at'>,
  today: string,
  paid: PaidDue[],
): PayState {
  const isPaid = (due: string) => paid.some((p) => p.recurring_id === c.id && p.recurring_due === due)
  const added = c.created_at.slice(0, 10)
  const last = lastDue(c, today)
  // a due date from before the cost was added was paid outside the app
  if (daysUntil(last, today) >= -PAY_LATE_DAYS && last >= added) {
    if (!isPaid(last)) return { kind: 'due', due: last }
    // paid for this one: say so until the next is close
  }
  const next = nextDue(c, today)
  if (isPaid(next)) return { kind: 'paid', due: next }
  if (isPaid(last) && daysUntil(next, today) > PAY_AHEAD_DAYS) return { kind: 'paid', due: last }
  if (daysUntil(next, today) <= PAY_AHEAD_DAYS) return { kind: 'soon', due: next }
  return { kind: 'none' }
}

/**
 * The due dates to log by themselves: for a cost set to add itself, the one
 * that has come this month (today included) and isn't logged yet. Earlier
 * months are left alone, so turning it on doesn't fill in the past.
 */
export function autoDue(
  c: Pick<
    RecurringCost,
    'id' | 'due_on' | 'every_months' | 'archived' | 'category_id' | 'auto_log' | 'created_at'
  >,
  today: string,
  paid: PaidDue[],
): string | null {
  if (!c.auto_log || c.archived || !c.category_id) return null
  const last = lastDue(c, today)
  // this month's, and not one from before it was added (that was paid outside the app)
  if (last.slice(0, 7) !== today.slice(0, 7) || last < c.created_at.slice(0, 10)) return null
  return paid.some((p) => p.recurring_id === c.id && p.recurring_due === last) ? null : last
}
