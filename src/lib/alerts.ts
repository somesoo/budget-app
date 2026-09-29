import { t } from '../i18n'
import type { Category, Expense, Person } from '../types'
import { isOthersAllowance } from './allowance'
import {
  daysInMonth,
  formatMoneyWhole,
  monthKeyOfDate,
  roundMoney,
  type MonthKey,
} from './calculations'
import { elapsedDays, projectMonthEnd } from './insights'
import { personLabel } from './people'

/* When spending stops keeping to the budget: the thresholds and the arithmetic
   behind every warning the app shows. */

/** Share of a limit at which a category counts as close to it. */
export const NEAR_RATIO = 0.8

export type LimitLevel = 'ok' | 'near' | 'over'

export function limitLevel(spent: number, limit: number, nearRatio = NEAR_RATIO): LimitLevel {
  if (limit <= 0) return 'ok'
  if (spent > limit) return 'over'
  return spent / limit >= nearRatio ? 'near' : 'ok'
}

export interface LimitImpact {
  before: number
  after: number
  limit: number
  levelBefore: LimitLevel
  levelAfter: LimitLevel
  /** Above the limit after this expense; 0 when within it. */
  overBy: number
  /** Still available after this expense; 0 when over. */
  left: number
}

/** What one more expense does to a category's month. */
export function limitImpact(
  spent: number,
  amount: number,
  limit: number,
  nearRatio = NEAR_RATIO,
): LimitImpact {
  const after = roundMoney(spent + amount)
  return {
    before: spent,
    after,
    limit,
    levelBefore: limitLevel(spent, limit, nearRatio),
    levelAfter: limitLevel(after, limit, nearRatio),
    overBy: limit > 0 ? Math.max(roundMoney(after - limit), 0) : 0,
    left: limit > 0 ? Math.max(roundMoney(limit - after), 0) : 0,
  }
}

/* ---------- the month's warnings ---------- */

export type AlertKind = 'near' | 'pace' | 'over'

/** Which of two warnings about the same thing matters more. */
export const ALERT_RANK: Record<AlertKind, number> = { near: 1, pace: 2, over: 3 }

/** A straight-line projection means little in the first week of a month. */
export const PACE_MIN_DAYS = 7
/** ...or for a category with only a couple of expenses so far. */
export const PACE_MIN_EXPENSES = 4
/** Heading over by less than this is within the noise of a projection. */
const PACE_MARGIN = 1.05

export interface BudgetAlert {
  /** Stable per month, thing and kind: `2026-09:<category id>:over`, `2026-09:total:pace`. */
  id: string
  kind: AlertKind
  /** A category, or the whole month's budget. */
  category: Category | null
  spent: number
  limit: number
  /** Month-end projection; null where a projection doesn't apply. */
  projected: number | null
  daysLeft: number
  title: string
  detail: string
  /** About the other one's allowance: say it's over, show no numbers. */
  private?: boolean
}

/** What a warning is about, so dismissing it can also cover lesser ones: `2026-09:<id>`. */
export const alertSubject = (a: Pick<BudgetAlert, 'id'>) => a.id.slice(0, a.id.lastIndexOf(':'))

/**
 * Where the month stops keeping to the budget: categories at 80% or over
 * their limit, and those whose pace would take them over it by the month's
 * end, plus the same for the whole budget. Most serious first.
 *
 * Fixed costs (categories left out of the Home chart, like rent) are paid in
 * one go: they only warn once actually over, never for being close or for
 * their pace, and in the month's projection they count as they are instead
 * of being multiplied out.
 */
export function budgetAlerts(args: {
  month: MonthKey
  expenses: Expense[]
  categories: Category[]
  /** This device's preferences: where "close to the limit" starts, and whether pace warns. */
  nearRatio?: number
  pace?: boolean
  /** Who this device belongs to: the other one's allowance only says when it's over. */
  me?: Person | null
}): BudgetAlert[] {
  const { month, categories, nearRatio = NEAR_RATIO, pace = true } = args
  const expenses = args.expenses.filter((e) => monthKeyOfDate(e.expense_date) === month)
  const elapsed = elapsedDays(month)
  // today still counts: it can still be spent in, as the Budget tab says too
  const daysLeft = elapsed > 0 ? daysInMonth(month) - elapsed + 1 : 0
  const paceOn = pace && elapsed >= PACE_MIN_DAYS && daysLeft > 0

  const spentBy = new Map<string, number>()
  const countBy = new Map<string, number>()
  for (const e of expenses) {
    spentBy.set(e.category_id, (spentBy.get(e.category_id) ?? 0) + e.amount)
    countBy.set(e.category_id, (countBy.get(e.category_id) ?? 0) + 1)
  }

  const alerts: BudgetAlert[] = []
  for (const category of categories) {
    const spent = roundMoney(spentBy.get(category.id) ?? 0)
    const limit = category.monthly_limit
    if (category.archived && spent === 0) continue
    if (limit <= 0) continue
    const level = limitLevel(spent, limit, nearRatio)
    if (args.me !== undefined && isOthersAllowance(category, args.me)) {
      if (level === 'over') alerts.push(privateOver({ month, category, spent, limit, daysLeft }))
      continue
    }
    const projected =
      paceOn &&
      category.show_in_chart !== false &&
      (countBy.get(category.id) ?? 0) >= PACE_MIN_EXPENSES
        ? projectMonthEnd(spent, month)
        : null
    const kind: AlertKind | null =
      level === 'over'
        ? 'over'
        : projected !== null && projected > limit * PACE_MARGIN
          ? 'pace'
          : // a fixed cost paid in full is at 100% by design, not a warning
            level === 'near' && category.show_in_chart !== false
            ? 'near'
            : null
    if (kind) alerts.push(describe({ month, kind, category, spent, limit, projected, daysLeft }))
  }

  // the whole budget: fixed costs as they are, everything else projected
  const counted = categories.filter((c) => !c.archived || (spentBy.get(c.id) ?? 0) > 0)
  const limit = roundMoney(counted.reduce((a, c) => a + c.monthly_limit, 0))
  if (limit > 0) {
    const fixedIds = new Set(counted.filter((c) => c.show_in_chart === false).map((c) => c.id))
    const spent = roundMoney(expenses.reduce((a, e) => a + e.amount, 0))
    const fixed = expenses
      .filter((e) => fixedIds.has(e.category_id))
      .reduce((a, e) => a + e.amount, 0)
    const projected = paceOn
      ? roundMoney(fixed + (projectMonthEnd(spent - fixed, month) ?? 0))
      : null
    const kind: AlertKind | null =
      spent > limit ? 'over' : projected !== null && projected > limit * PACE_MARGIN ? 'pace' : null
    if (kind)
      alerts.push(describe({ month, kind, category: null, spent, limit, projected, daysLeft }))
  }

  return alerts.sort((a, b) => ALERT_RANK[b.kind] - ALERT_RANK[a.kind] || excess(b) - excess(a))
}

const excess = (a: BudgetAlert) => Math.max(a.spent, a.projected ?? 0) / a.limit

function describe(args: {
  month: MonthKey
  kind: AlertKind
  category: Category | null
  spent: number
  limit: number
  projected: number | null
  daysLeft: number
}): BudgetAlert {
  const { month, kind, category, spent, limit, projected, daysLeft } = args
  const perDay = daysLeft > 0 ? Math.max(limit - spent, 0) / daysLeft : 0
  const values = {
    name: category?.name ?? '',
    spent: formatMoneyWhole(spent),
    limit: formatMoneyWhole(limit),
    over: formatMoneyWhole(spent - limit),
    left: formatMoneyWhole(limit - spent),
    projected: formatMoneyWhole(projected ?? spent),
    perDay: formatMoneyWhole(Math.floor(perDay)),
    percent: Math.round((spent / limit) * 100),
    count: daysLeft,
  }
  const scope = category ? 'category' : 'month'

  let title: string
  let detail: string
  if (kind === 'over') {
    title = t(`alerts.${scope}.overTitle`, values)
    detail =
      daysLeft > 0 ? t('alerts.overDetailDaysLeft', values) : t('alerts.overDetail', values)
  } else if (kind === 'pace') {
    title = t(`alerts.${scope}.paceTitle`, values)
    detail = t('alerts.paceDetail', values)
  } else {
    title = t(`alerts.${scope}.nearTitle`, values)
    detail =
      daysLeft > 0 ? t('alerts.nearDetailDaysLeft', values) : t('alerts.nearDetail', values)
  }

  return {
    id: `${month}:${category ? category.id : 'total'}:${kind}`,
    kind,
    category,
    spent,
    limit,
    projected,
    daysLeft,
    title,
    detail,
  }
}

/** The other one's allowance went over: that it did, not by how much or on what. */
function privateOver(args: {
  month: MonthKey
  category: Category
  spent: number
  limit: number
  daysLeft: number
}): BudgetAlert {
  const { month, category, spent, limit, daysLeft } = args
  const who = category.owner ? personLabel(category.owner) : t('alerts.someone')
  return {
    id: `${month}:${category.id}:over`,
    kind: 'over',
    category,
    spent,
    limit,
    projected: null,
    daysLeft,
    title: t('alerts.privateOverTitle', { who }),
    detail: t('alerts.privateOverDetail', { name: category.name }),
    private: true,
  }
}

/**
 * What to say right after saving, when the expense took its category into a
 * new zone; null when nothing changed worth mentioning.
 */
export function crossingNote(category: Category, impact: LimitImpact): string | null {
  if (impact.levelAfter === impact.levelBefore || impact.levelAfter === 'ok') return null
  return impact.levelAfter === 'over'
    ? t('alerts.crossedOver', { name: category.name, over: formatMoneyWhole(impact.overBy) })
    : t('alerts.crossedNear', {
        name: category.name,
        percent: Math.round((impact.after / impact.limit) * 100),
      })
}
