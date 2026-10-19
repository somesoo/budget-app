import { PROJECTION_ONE_OFF_FROM } from '../config'
import type { Category, Expense } from '../types'
import {
  categoryById,
  daysInMonth,
  monthKeyOfDate,
  roundMoney,
  shiftMonth,
  type MonthKey,
} from './calculations'
import { elapsedDays } from './insights'
import { isFixedGroup } from './paySplit'

/* Where the month's spending is heading. A straight line through everything
   (spent ÷ days so far × days in the month) turns rent paid on the 1st into
   thirty rents. So only the everyday part is extended: fixed costs count once,
   at what they usually come to, and big one-offs count as they are. */

/** Complete months before this one that "usual" is learnt from. */
const TYPICAL_MONTHS = 3

export interface SpendProjection {
  /** Where the month ends up. */
  total: number
  /** Bills and debts: paid so far, or what they usually come to if more. */
  fixed: number
  /** Of `fixed`, what's still to be paid this month. */
  fixedToCome: number
  /** Single everyday expenses of PROJECTION_ONE_OFF_FROM or more, as they are. */
  oneOffs: number
  /** The rest, spent so far. */
  everydaySoFar: number
  /** The rest, at the month's end. */
  everyday: number
}

/**
 * The running month's projection. `expenses` may reach back a few months:
 * those teach what fixed costs come to and how much a day everyday spending
 * usually is. Early in the month the usual daily amount weighs most, and this
 * month's own pace takes over as the days go by, so one big shop on the 2nd
 * doesn't set the month. Null for a month that hasn't started.
 */
export function projectSpend(args: {
  month: MonthKey
  expenses: Expense[]
  categories: Category[]
  /** Categories a regular cost is booked to: fixed, like rent. */
  billCategoryIds: ReadonlySet<string>
  /** Days gone, today included; the calendar's by default. */
  elapsed?: number
}): SpendProjection | null {
  const { month, expenses, categories, billCategoryIds } = args
  const days = daysInMonth(month)
  const elapsed = args.elapsed ?? elapsedDays(month)
  if (elapsed <= 0) return null

  const byId = categoryById(categories)
  const isFixed = (categoryId: string) => {
    const c = byId[categoryId]
    return c ? isFixedGroup(c, billCategoryIds) : false
  }

  // the months before with anything logged: a month before the first expense is no data
  const before = Array.from({ length: TYPICAL_MONTHS }, (_, i) => shiftMonth(month, -(i + 1)))
  const inMonth = (m: MonthKey) => expenses.filter((e) => monthKeyOfDate(e.expense_date) === m)
  const history = before.map((m) => ({ month: m, list: inMonth(m) })).filter((h) => h.list.length > 0)
  const now = inMonth(month)

  /* ---------- fixed: once, at what it usually comes to ---------- */
  const fixedNow = new Map<string, number>()
  for (const e of now) {
    if (isFixed(e.category_id)) fixedNow.set(e.category_id, (fixedNow.get(e.category_id) ?? 0) + e.amount)
  }
  const fixedIds = new Set([
    ...fixedNow.keys(),
    ...history.flatMap((h) => h.list.filter((e) => isFixed(e.category_id)).map((e) => e.category_id)),
  ])
  let fixed = 0
  let fixedToCome = 0
  for (const id of fixedIds) {
    const spent = fixedNow.get(id) ?? 0
    // archived and not paid this month: it's gone, not still to come
    if (byId[id]?.archived && spent === 0) continue
    // the lower median, not the average: yearly insurance paid in July isn't
    // a third of it due every month after
    const months = history
      .map((h) => h.list.filter((e) => e.category_id === id).reduce((a, e) => a + e.amount, 0))
      .sort((a, b) => a - b)
    const usual = months.length > 0 ? months[Math.floor((months.length - 1) / 2)] : 0
    const expected = Math.max(spent, usual)
    fixed += expected
    fixedToCome += expected - spent
  }

  /* ---------- everyday: big one-offs as they are, the rest by the day ---------- */
  const isOneOff = (e: Expense) => e.amount >= PROJECTION_ONE_OFF_FROM
  const everydayOf = (list: Expense[]) =>
    list.filter((e) => !isFixed(e.category_id) && !isOneOff(e)).reduce((s, e) => s + e.amount, 0)

  const oneOffs = now
    .filter((e) => !isFixed(e.category_id) && isOneOff(e))
    .reduce((s, e) => s + e.amount, 0)
  const everydaySoFar = everydayOf(now)
  const paceNow = everydaySoFar / elapsed
  const usualPerDay =
    history.length > 0
      ? history.reduce((s, h) => s + everydayOf(h.list) / daysInMonth(h.month), 0) / history.length
      : null
  // how far into the month we are is how much this month's own pace is trusted
  const weight = elapsed / days
  const perDay = usualPerDay === null ? paceNow : weight * paceNow + (1 - weight) * usualPerDay
  const everyday = everydaySoFar + perDay * (days - elapsed)

  return {
    total: roundMoney(fixed + oneOffs + everyday),
    fixed: roundMoney(fixed),
    fixedToCome: roundMoney(fixedToCome),
    oneOffs: roundMoney(oneOffs),
    everydaySoFar: roundMoney(everydaySoFar),
    everyday: roundMoney(everyday),
  }
}
