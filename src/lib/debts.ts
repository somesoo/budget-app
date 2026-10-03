import type { Debt, DebtBalance } from '../types'
import { monthKeyOfDate, roundMoney, shiftMonth, type MonthKey } from './calculations'

/*
 * Debts: what's owed is the latest balance logged; how it goes from there is
 * arithmetic on the rate and the monthly payment. Interest is worked out
 * monthly (yearly rate / 12), which is how Polish loans and cards charge it;
 * it's an estimate, since rates change and banks round their own way.
 */

/** Past this many months a plan counts as never finishing (50 years). */
export const MAX_MONTHS = 600

/** A debt's balances, newest first. */
export function balancesOf(balances: DebtBalance[], debtId: string): DebtBalance[] {
  return balances
    .filter((b) => b.debt_id === debtId)
    .sort(
      (a, b) =>
        b.balance_date.localeCompare(a.balance_date) || b.created_at.localeCompare(a.created_at),
    )
}

/** What's owed now: the latest balance, or 0 before the first one. */
export function currentBalance(balances: DebtBalance[], debtId: string): number {
  return balancesOf(balances, debtId)[0]?.balance ?? 0
}

/** What was owed at the end of `month`: the last balance logged by then, 0 before any. */
export function balanceAtMonthEnd(own: DebtBalance[], month: MonthKey): number {
  let found: DebtBalance | null = null
  for (const b of own) {
    if (monthKeyOfDate(b.balance_date) > month) continue
    if (
      !found ||
      b.balance_date > found.balance_date ||
      (b.balance_date === found.balance_date && b.created_at > found.created_at)
    ) {
      found = b
    }
  }
  return found?.balance ?? 0
}

const monthlyRate = (ratePct: number | null) => (ratePct ?? 0) / 100 / 12

/** The month's interest on `balance`. */
export function monthInterest(balance: number, ratePct: number | null): number {
  return roundMoney(balance * monthlyRate(ratePct))
}

/** The balance once this month's instalment is paid: interest added, the payment taken off. */
export function afterInstalment(balance: number, ratePct: number | null, payment: number): number {
  return Math.max(0, roundMoney(balance + monthInterest(balance, ratePct) - payment))
}

export interface Payoff {
  /** Months until it's paid off; null when the payment doesn't even cover the interest. */
  months: number | null
  /** The month the last payment falls in. */
  month: MonthKey | null
  /** Interest paid on the way. */
  interest: number
}

/** One debt paid off on its own, at `payment` a month from the month after `from`. */
export function payoff(
  balance: number,
  ratePct: number | null,
  payment: number,
  from: MonthKey,
): Payoff {
  const plan = payoffPlan([{ id: 'one', balance, ratePct, payment }], 0, 'avalanche', from)
  return { months: plan.months, month: plan.month, interest: plan.interest }
}

export type Strategy = 'snowball' | 'avalanche'

export interface PlanDebt {
  id: string
  balance: number
  ratePct: number | null
  /** Its own monthly payment, the minimum the plan always pays. */
  payment: number
}

export interface PayoffPlan {
  /** Months until the last one's paid; null when it never is. */
  months: number | null
  month: MonthKey | null
  /** Interest paid on all of them together. */
  interest: number
  /** The order the extra money goes in. */
  order: string[]
  /** When each one is paid off. */
  byDebt: Record<string, { months: number | null; month: MonthKey | null }>
}

/**
 * Pays every debt its own payment each month, and puts `extra` on top onto
 * one at a time: the smallest balance first (snowball: quick wins), or the
 * highest rate first (avalanche: the least interest). When one is paid off,
 * its payment joins the extra for the next, so the money aimed at debts stays
 * the same until all are gone.
 */
export function payoffPlan(
  debts: PlanDebt[],
  extra: number,
  strategy: Strategy,
  from: MonthKey,
): PayoffPlan {
  const live = debts.filter((d) => d.balance > 0)
  const order = [...live]
    .sort((a, b) =>
      strategy === 'snowball'
        ? a.balance - b.balance || (b.ratePct ?? 0) - (a.ratePct ?? 0)
        : (b.ratePct ?? 0) - (a.ratePct ?? 0) || a.balance - b.balance,
    )
    .map((d) => d.id)

  const left = new Map(live.map((d) => [d.id, d.balance]))
  const doneAt = new Map<string, number>()
  // the total aimed at debts each month: their payments plus the extra
  const budget = live.reduce((s, d) => s + d.payment, 0) + Math.max(0, extra)
  let interest = 0
  let month = 0

  while (left.size > 0 && month < MAX_MONTHS) {
    month++
    for (const d of live) {
      const owed = left.get(d.id)
      if (owed === undefined) continue
      const i = monthInterest(owed, d.ratePct)
      interest += i
      left.set(d.id, owed + i)
    }
    let pool = budget
    // everyone's own payment first…
    for (const d of live) {
      const owed = left.get(d.id)
      if (owed === undefined) continue
      const pay = Math.min(d.payment, owed, pool)
      left.set(d.id, owed - pay)
      pool -= pay
    }
    // …then what's left, in the plan's order
    for (const id of order) {
      if (pool <= 0) break
      const owed = left.get(id)
      if (owed === undefined || owed <= 0) continue
      const pay = Math.min(owed, pool)
      left.set(id, owed - pay)
      pool -= pay
    }
    for (const [id, owed] of left) {
      if (owed <= 0.005) {
        left.delete(id)
        doneAt.set(id, month)
      }
    }
  }

  const finished = left.size === 0
  const byDebt: PayoffPlan['byDebt'] = {}
  for (const d of debts) {
    const m = d.balance <= 0 ? 0 : (doneAt.get(d.id) ?? null)
    byDebt[d.id] = { months: m, month: m === null ? null : shiftMonth(from, m) }
  }
  const months = finished ? month : null
  return {
    months,
    month: months === null ? null : shiftMonth(from, months),
    interest: roundMoney(interest),
    order,
    byDebt,
  }
}

/** The plan's input from the debts as they stand: open ones with something owed. */
export function planDebts(debts: Debt[], balances: DebtBalance[]): PlanDebt[] {
  return debts
    .filter((d) => !d.archived)
    .map((d) => ({
      id: d.id,
      balance: currentBalance(balances, d.id),
      ratePct: d.interest_rate,
      payment: d.monthly_payment,
    }))
    .filter((d) => d.balance > 0)
}

/** What paying each debt on its own, with no extra and nothing rolled over, comes to. */
export function separatePayoff(debts: PlanDebt[], from: MonthKey): { months: number | null; interest: number } {
  let months: number | null = 0
  let interest = 0
  for (const d of debts) {
    const p = payoff(d.balance, d.ratePct, d.payment, from)
    interest += p.interest
    months = months === null || p.months === null ? null : Math.max(months, p.months)
  }
  return { months, interest: roundMoney(interest) }
}
