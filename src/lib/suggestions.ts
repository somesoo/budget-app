import { formatList, t } from '../i18n'
import type { Category, Expense, Goal } from '../types'
import {
  formatMoneyWhole,
  formatMonth,
  formatMonthName,
  formatMonthShort,
  monthKeyOfDate,
  roundMoney,
  shiftMonth,
  type MonthKey,
} from './calculations'
import { draftTotals, roundUpPlan, type PlanBaseline, type PlanDraft } from './planning'

/*
 * Suggestions for planning a month, worked out from past months. Like the
 * rest of lib/, arithmetic only: every figure a suggestion names comes from
 * logged expenses, and each one says which.
 */

export type SuggestionKind = 'raise' | 'lower' | 'buffer' | 'annual' | 'seasonal'

export interface Suggestion {
  id: string
  kind: SuggestionKind
  categoryId: string
  /** The limit it proposes for the category. */
  limit: number
  title: string
  detail: string
  /** A line for the month's note, for a bill that comes once a year. */
  noteLine?: string
}

/** Months looked at for "keeps running over / under". */
const STREAK = 3
/** "Well under": below this share of the limit, month after month. */
const UNDER_RATIO = 0.8
/** Lowering by less isn't worth a suggestion. */
const MIN_FREED = 20
/** A category swinging more than this (std / mean) gets a buffer suggestion. */
const VOLATILE_CV = 0.35
/** A bill counts as yearly from this size, or this share of a typical month. */
const ANNUAL_MIN = 100
const ANNUAL_MIN_SHARE = 0.2
/** Same month last year above typical by this much reads as seasonal. */
const SEASONAL_RATIO = 1.3
const SEASONAL_MIN = 100

/** The same month last year clearly above a typical one: December, holidays, a season. */
const isSeasonal = (ly: number | null, typical: number | null) =>
  ly !== null && typical !== null && ly > typical * SEASONAL_RATIO && ly - typical >= SEASONAL_MIN

const normalizeNote = (note: string) => note.trim().toLowerCase().replace(/\s+/g, ' ')

function quantile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * What the history says about the draft, per category, against the limits
 * as drafted right now. A suggestion that has been applied no longer holds,
 * so it drops out on its own.
 */
export function planSuggestions(args: {
  target: MonthKey
  baseline: PlanBaseline
  draftLimits: Record<string, number>
  /** The expenses behind the baseline (complete months), for yearly bills. */
  expenses: Expense[]
}): Suggestion[] {
  const { target, baseline, draftLimits, expenses } = args
  const months = baseline.months
  const out: Suggestion[] = []
  const lastYear = shiftMonth(target, -12)
  const annual = annualBills(expenses, target, months)

  for (const b of baseline.categories) {
    const { category, history, typical } = b
    const limit = draftLimits[category.id] ?? category.monthly_limit
    const name = category.name
    const recent = history.slice(-STREAK)
    const recentMonths = months.slice(-STREAK)
    let covered = false

    const bills = annual.filter((a) => a.categoryId === category.id)
    // a month with a known one-off, or that cost more last year, is meant to
    // differ from the recent run; raising or lowering to that run would undo it
    const unusual = bills.length > 0 || isSeasonal(b.sameMonthLastYear, typical)

    if (!unusual && recent.length === STREAK && limit > 0) {
      if (recent.every((x) => x > limit) && typical !== null && roundUpPlan(typical) > limit) {
        out.push({
          id: `raise:${category.id}`,
          kind: 'raise',
          categoryId: category.id,
          limit: roundUpPlan(typical),
          title: t('suggestions.raiseTitle', {
            name,
            amount: formatMoneyWhole(roundUpPlan(typical)),
          }),
          detail: t('suggestions.raiseDetail', {
            limit: formatMoneyWhole(limit),
            count: STREAK,
            months: recent
              .map((x, i) => `${formatMonthShort(recentMonths[i])} ${formatMoneyWhole(x)}`)
              .join(', '),
          }),
        })
        covered = true
      } else if (recent.every((x) => x < limit * UNDER_RATIO)) {
        const proposed = roundUpPlan(Math.max(...recent))
        const freed = roundMoney(limit - proposed)
        if (freed >= MIN_FREED) {
          out.push({
            id: `lower:${category.id}`,
            kind: 'lower',
            categoryId: category.id,
            limit: proposed,
            title: t('suggestions.lowerTitle', { name, amount: formatMoneyWhole(proposed) }),
            detail: t('suggestions.lowerDetail', {
              percent: Math.round(UNDER_RATIO * 100),
              count: STREAK,
              most: formatMoneyWhole(Math.max(...recent)),
              freed: formatMoneyWhole(freed),
            }),
          })
          covered = true
        }
      }
    }

    for (const bill of bills) {
      const proposed = roundUpPlan((typical ?? 0) + bill.amount)
      if (limit >= proposed) continue
      out.push({
        id: `annual:${category.id}:${normalizeNote(bill.note)}`,
        kind: 'annual',
        categoryId: category.id,
        limit: proposed,
        title: t('suggestions.annualTitle', {
          note: bill.note,
          amount: formatMoneyWhole(bill.amount),
          month: formatMonthName(target),
        }),
        detail: t('suggestions.annualDetail', {
          month: formatMonth(lastYear),
          name,
          amount: formatMoneyWhole(proposed),
        }),
        noteLine: t('suggestions.annualNoteLine', {
          note: bill.note,
          amount: formatMoneyWhole(bill.amount),
        }),
      })
      covered = true
    }

    const ly = b.sameMonthLastYear
    if (
      !covered &&
      ly !== null &&
      typical !== null &&
      isSeasonal(ly, typical) &&
      roundUpPlan(ly) > limit
    ) {
      out.push({
        id: `seasonal:${category.id}`,
        kind: 'seasonal',
        categoryId: category.id,
        limit: roundUpPlan(ly),
        title: t('suggestions.seasonalTitle', { month: formatMonthName(target), name }),
        detail: t('suggestions.seasonalDetail', {
          lastYear: formatMoneyWhole(ly),
          month: formatMonthName(target),
          typical: formatMoneyWhole(typical),
          amount: formatMoneyWhole(roundUpPlan(ly)),
        }),
      })
      covered = true
    }

    const six = history.slice(-6)
    if (!covered && six.length === 6 && category.show_in_chart !== false) {
      const mean = six.reduce((a, x) => a + x, 0) / six.length
      const sd = Math.sqrt(six.reduce((a, x) => a + (x - mean) ** 2, 0) / six.length)
      const p75 = roundUpPlan(quantile(six, 0.75))
      if (mean > 0 && sd / mean > VOLATILE_CV && p75 > limit) {
        out.push({
          id: `buffer:${category.id}`,
          kind: 'buffer',
          categoryId: category.id,
          limit: p75,
          title: t('suggestions.bufferTitle', { name, amount: formatMoneyWhole(p75) }),
          detail: t('suggestions.bufferDetail', {
            low: formatMoneyWhole(Math.min(...six)),
            high: formatMoneyWhole(Math.max(...six)),
            amount: formatMoneyWhole(p75),
          }),
        })
      }
    }
  }

  return out
}

export interface Bill {
  categoryId: string
  note: string
  amount: number
}

/**
 * Bills paid in the target's calendar month a year ago that haven't come
 * back since: insurance, a yearly subscription, gifts. Big enough to matter
 * and named (a note), so the suggestion can say what it was.
 */
export function annualBills(expenses: Expense[], target: MonthKey, months: MonthKey[]): Bill[] {
  const lastYear = shiftMonth(target, -12)
  const seenLater = new Set<string>()
  const byKey = new Map<string, Bill>()
  const typicalBy = new Map<string, number>()

  const monthCount = Math.max(months.length, 1)
  for (const e of expenses)
    typicalBy.set(e.category_id, (typicalBy.get(e.category_id) ?? 0) + e.amount / monthCount)

  for (const e of expenses) {
    if (!e.note) continue
    const key = `${e.category_id}:${normalizeNote(e.note)}`
    const m = monthKeyOfDate(e.expense_date)
    if (m === lastYear) {
      const bill = byKey.get(key) ?? { categoryId: e.category_id, note: e.note.trim(), amount: 0 }
      bill.amount = roundMoney(bill.amount + e.amount)
      byKey.set(key, bill)
    } else if (m > lastYear) {
      seenLater.add(key)
    }
  }

  return [...byKey.entries()]
    .filter(([key]) => !seenLater.has(key))
    .map(([, bill]) => bill)
    .filter(
      (bill) =>
        bill.amount >= ANNUAL_MIN &&
        bill.amount >= (typicalBy.get(bill.categoryId) ?? 0) * ANNUAL_MIN_SHARE,
    )
    .sort((a, b) => b.amount - a.amount)
}

export interface Recurring extends Bill {
  /** How many of the last months it showed up in. */
  months: number
}

/**
 * Payments that come once every month for about the same amount (a
 * subscription, a phone plan, rent): the part of a plan that's already certain.
 */
export function recurringCosts(expenses: Expense[], months: MonthKey[]): Recurring[] {
  const recent = months.slice(-STREAK)
  if (recent.length < STREAK) return []
  const inRecent = new Set(recent)

  const byKey = new Map<
    string,
    { bill: Bill; perMonth: Map<MonthKey, number>; count: Map<MonthKey, number> }
  >()
  for (const e of expenses) {
    const m = monthKeyOfDate(e.expense_date)
    if (!e.note || !inRecent.has(m)) continue
    const key = `${e.category_id}:${normalizeNote(e.note)}`
    let row = byKey.get(key)
    if (!row) {
      row = {
        bill: { categoryId: e.category_id, note: e.note.trim(), amount: 0 },
        perMonth: new Map(),
        count: new Map(),
      }
      byKey.set(key, row)
    }
    row.perMonth.set(m, (row.perMonth.get(m) ?? 0) + e.amount)
    row.count.set(m, (row.count.get(m) ?? 0) + 1)
  }

  const out: Recurring[] = []
  for (const { bill, perMonth, count } of byKey.values()) {
    if (perMonth.size < STREAK) continue
    // a bill is paid once a month; a shop visited now and then isn't one, even when the sums match
    if ([...count.values()].some((c) => c > 1)) continue
    const amounts = recent.map((m) => perMonth.get(m) ?? 0)
    const mid = quantile(amounts, 0.5)
    // "about the same": every month within 15% of the middle one
    if (mid <= 0 || amounts.some((x) => Math.abs(x - mid) > mid * 0.15)) continue
    out.push({ ...bill, amount: roundMoney(amounts[amounts.length - 1]), months: perMonth.size })
  }
  return out.sort((a, b) => b.amount - a.amount)
}

/* ---------- checking a plan before saving it ---------- */

export interface PlanCheck {
  ok: boolean
  text: string
}

/** A short read of the draft: does it balance, is it realistic, what does it save. Informs, never blocks. */
export function planChecks(args: {
  draft: PlanDraft
  baseline: PlanBaseline
  activeIds: string[]
  goal: Goal | null | undefined
}): PlanCheck[] {
  const { draft, baseline, activeIds, goal } = args
  const { unassigned } = draftTotals(draft, activeIds)
  const checks: PlanCheck[] = []

  if (draft.income <= 0) {
    checks.push({ ok: false, text: t('suggestions.checkNoIncome') })
  } else if (Math.abs(unassigned) < 1) {
    checks.push({ ok: true, text: t('suggestions.checkBalanced') })
  } else if (unassigned > 0) {
    checks.push({
      ok: false,
      text: t('suggestions.checkUnassigned', { amount: formatMoneyWhole(unassigned) }),
    })
  } else {
    checks.push({
      ok: false,
      text: t('suggestions.checkOverplanned', { amount: formatMoneyWhole(-unassigned) }),
    })
  }

  const tight = baseline.categories.filter((b) => {
    const recent = b.history.slice(-STREAK)
    const lowest = Math.min(...recent)
    const limit = draft.limits[b.category.id] ?? 0
    return recent.length === STREAK && lowest > 0 && limit < lowest
  })
  if (tight.length > 0) {
    const names = tight.map((b) => b.category.name)
    checks.push({
      ok: false,
      text: t(names.length === 1 ? 'suggestions.checkTightOne' : 'suggestions.checkTightMany', {
        names: formatList(names),
        count: STREAK,
      }),
    })
  } else if (baseline.months.length >= STREAK) {
    checks.push({ ok: true, text: t('suggestions.checkRealistic', { count: STREAK }) })
  }

  if (draft.income > 0) {
    checks.push(
      draft.savings > 0
        ? {
            ok: true,
            text: t('suggestions.checkSaving', {
              percent: Math.round((draft.savings / draft.income) * 100),
            }),
          }
        : { ok: false, text: t('suggestions.checkNoSavings') },
    )
  }

  if (goal && draft.savings > 0) {
    const left = Math.max(goal.target_amount - goal.current_amount, 0)
    if (left > 0) {
      const n = Math.ceil(left / draft.savings)
      checks.push({
        ok: true,
        text: t('suggestions.checkGoal', { name: goal.name, count: n }),
      })
    }
  }

  return checks
}

/* ---------- looking back at a finished month ---------- */

export interface MonthReview {
  month: MonthKey
  spent: number
  limit: number
  income: number
  /** Income minus spending. */
  saved: number
  /** What the plan meant to save; null without a plan. */
  plannedSavings: number | null
  /** Categories that ended over their limit, biggest overshoot first. */
  over: { category: Category; spent: number; limit: number }[]
  /** Categories that ended well under, most left first. */
  under: { category: Category; spent: number; limit: number }[]
}

export function monthReview(args: {
  month: MonthKey
  expenses: Expense[]
  /** With the month's own limits (its plan where it had one). */
  categories: Category[]
  income: number
  plannedSavings: number | null
}): MonthReview {
  const { month, categories, income, plannedSavings } = args
  const expenses = args.expenses.filter((e) => monthKeyOfDate(e.expense_date) === month)
  const spentBy = new Map<string, number>()
  for (const e of expenses) spentBy.set(e.category_id, (spentBy.get(e.category_id) ?? 0) + e.amount)
  const counted = categories.filter((c) => !c.archived || (spentBy.get(c.id) ?? 0) > 0)
  const rows = counted.map((category) => ({
    category,
    spent: roundMoney(spentBy.get(category.id) ?? 0),
    limit: category.monthly_limit,
  }))
  const spent = roundMoney(expenses.reduce((a, e) => a + e.amount, 0))

  return {
    month,
    spent,
    limit: roundMoney(counted.reduce((a, c) => a + c.monthly_limit, 0)),
    income,
    saved: roundMoney(income - spent),
    plannedSavings,
    over: rows
      .filter((r) => r.limit > 0 && r.spent > r.limit)
      .sort((a, b) => b.spent - b.limit - (a.spent - a.limit)),
    under: rows
      .filter((r) => r.limit > 0 && r.spent < r.limit * UNDER_RATIO)
      .sort((a, b) => b.limit - b.spent - (a.limit - a.spent)),
  }
}
