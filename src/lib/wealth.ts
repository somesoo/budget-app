import type { Debt, DebtBalance, Expense, Income, SavingsMovement } from '../types'
import { incomeMonth, roundMoney, type MonthKey } from './calculations'
import { balanceAtMonthEnd } from './debts'
import { balanceHistory } from './savings'

/*
 * The big picture: what the household owns minus what it owes, how long
 * money waits between coming in and going out, and how far off living on
 * savings is. All arithmetic over what's already logged.
 */

/* ---------- net worth ---------- */

export interface NetWorthPoint {
  month: MonthKey
  /** Everything on the savings accounts at the month's end. */
  assets: number
  /** Everything owed at the month's end. */
  debts: number
  net: number
}

/**
 * Month-end net worth over `months` (oldest first). Savings come from the
 * movements; a debt counts at its last balance logged by then, and not at all
 * before its first one.
 */
export function netWorthHistory(args: {
  months: MonthKey[]
  movements: SavingsMovement[]
  debts: Debt[]
  balances: DebtBalance[]
}): NetWorthPoint[] {
  const assets = balanceHistory(args.movements, args.months)
  const own = args.debts.map((d) => args.balances.filter((b) => b.debt_id === d.id))
  return args.months.map((month, i) => {
    const owed = roundMoney(own.reduce((s, list) => s + balanceAtMonthEnd(list, month), 0))
    const a = assets[i].balance
    return { month, assets: a, debts: owed, net: roundMoney(a - owed) }
  })
}

/* ---------- age of money ---------- */

/** How many of the latest outflows the age is averaged over (as YNAB does). */
export const AGE_OF_MONEY_OUTFLOWS = 10

const dayNumber = (dateKey: string) => Math.round(Date.parse(`${dateKey}T12:00:00Z`) / 86_400_000)

/**
 * How many days money waits between coming in and going out: each outflow is
 * paid from the oldest income not spent yet (first in, first out), and the
 * age is the average gap over the latest outflows. 30 days or more means this
 * month runs on last month's money. Outflows are monthly spending and what
 * goes into savings; spending from goals is left out, since savings paid for
 * it. Money spent before the first income logged can't be dated and is
 * skipped. Null until an outflow can be dated.
 */
export function ageOfMoney(args: {
  incomes: Pick<Income, 'amount' | 'income_date'>[]
  /** Monthly spending only (no trips). */
  expenses: Pick<Expense, 'amount' | 'expense_date'>[]
  /** Money put into savings: deposits, as positive amounts with their date. */
  savedAside: { amount: number; date: string }[]
}): number | null {
  const inflows = args.incomes
    .map((i) => ({ day: dayNumber(i.income_date), left: i.amount }))
    .sort((a, b) => a.day - b.day)
  const outflows = [
    ...args.expenses.map((e) => ({ day: dayNumber(e.expense_date), amount: e.amount })),
    ...args.savedAside.map((s) => ({ day: dayNumber(s.date), amount: s.amount })),
  ].sort((a, b) => a.day - b.day)

  const ages: number[] = []
  let next = 0
  for (const out of outflows) {
    let need = out.amount
    let weighted = 0
    let dated = 0
    while (need > 0.005 && next < inflows.length && inflows[next].day <= out.day) {
      const take = Math.min(need, inflows[next].left)
      weighted += take * (out.day - inflows[next].day)
      dated += take
      need -= take
      inflows[next].left -= take
      if (inflows[next].left <= 0.005) next++
    }
    // paid (at least partly) from logged income: its age is the weighted gap
    if (dated > 0) ages.push(weighted / dated)
  }
  if (ages.length === 0) return null
  const last = ages.slice(-AGE_OF_MONEY_OUTFLOWS)
  return Math.round(last.reduce((s, a) => s + a, 0) / last.length)
}

/* ---------- financial independence ---------- */

export interface Independence {
  /** What it takes: yearly spending × FIRE_MULTIPLE. */
  target: number
  /** What there is towards it now. */
  have: number
  /** have / target, 0–1 (can pass 1). */
  progress: number
  /** Years until `have` reaches the target at the pace given; null when it never does. */
  years: number | null
}

/**
 * The FIRE arithmetic: with 25× a year's spending invested, taking 4% a year
 * out is likely to last for good (the "4% rule"). Years to get there grow the
 * savings by `realReturn` a year (after inflation), compounded monthly, plus
 * `monthlySaving` each month. An estimate to steer by, not a promise.
 */
export function independence(args: {
  monthlySpending: number
  have: number
  monthlySaving: number
  multiple: number
  realReturn: number
}): Independence | null {
  const { monthlySpending, have, monthlySaving, multiple, realReturn } = args
  if (monthlySpending <= 0) return null
  const target = roundMoney(monthlySpending * 12 * multiple)
  const progress = target > 0 ? have / target : 0
  if (have >= target) return { target, have, progress, years: 0 }
  const r = realReturn / 12
  let balance = have
  for (let month = 1; month <= 12 * 100; month++) {
    balance = balance * (1 + r) + monthlySaving
    if (balance >= target) return { target, have, progress, years: Math.round((month / 12) * 10) / 10 }
  }
  return { target, have, progress, years: null }
}

/** Average a month put into savings over `months` (deposits less withdrawals, trips' spending aside). */
export function averageSaving(movements: SavingsMovement[], months: MonthKey[]): number {
  if (months.length === 0) return 0
  const set = new Set(months)
  let total = 0
  for (const m of movements) {
    if (!set.has(m.movement_date.slice(0, 7))) continue
    if (m.kind === 'deposit' || m.kind === 'withdrawal') total += m.amount
  }
  return roundMoney(total / months.length)
}

/** Incomes in the given months, by the month they pay for. */
export function incomesIn(incomes: Income[], months: MonthKey[]): Income[] {
  const set = new Set(months)
  return incomes.filter((i) => set.has(incomeMonth(i)))
}
