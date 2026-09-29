import type { Allocation, Goal, SavingsAccount, SavingsMovement } from '../types'
import {
  currentMonthKey,
  monthKeyOfDate,
  roundMoney,
  shiftMonth,
  type MonthKey,
} from './calculations'

/*
 * Savings: accounts are where money is, goals what it's for, allocations the
 * link between the two. Balances come from movements; everything here is
 * arithmetic over those three lists, the same on both phones.
 */

/** Months from `from` to `to` (Sep 2026 → Apr 2027 is 7); negative when `to` is earlier. */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/* ---------- accounts ---------- */

export interface AccountSummary {
  account: SavingsAccount
  balance: number
  /** Set aside for goals. */
  allocated: number
  /** Balance not set aside for any goal. */
  unassigned: number
  /** Goal id → its share of this account. */
  byGoal: Record<string, number>
}

export function accountSummaries(
  accounts: SavingsAccount[],
  movements: SavingsMovement[],
  allocations: Allocation[],
): AccountSummary[] {
  const balance = new Map<string, number>()
  for (const m of movements) balance.set(m.account_id, (balance.get(m.account_id) ?? 0) + m.amount)
  return accounts.map((account) => {
    const mine = allocations.filter((a) => a.account_id === account.id)
    const allocated = roundMoney(mine.reduce((s, a) => s + a.amount, 0))
    const bal = roundMoney(balance.get(account.id) ?? 0)
    return {
      account,
      balance: bal,
      allocated,
      unassigned: roundMoney(bal - allocated),
      byGoal: Object.fromEntries(mine.map((a) => [a.goal_id, a.amount])),
    }
  })
}

/* ---------- goals ---------- */

export type GoalStatus =
  | { kind: 'reached' }
  /** No target amount: an emergency fund that just grows. */
  | { kind: 'open' }
  /** A target but no date: when it'll get there at the recent pace, if it's moving at all. */
  | { kind: 'no-date'; eta: MonthKey | null }
  | { kind: 'on-track'; neededPerMonth: number }
  | { kind: 'behind'; neededPerMonth: number; shortfall: number }
  /** The date has passed without reaching the target. */
  | { kind: 'overdue'; shortfall: number }

export interface GoalSummary {
  goal: Goal
  /** On the accounts for it now. */
  saved: number
  /** Spent from its share of the accounts (migration 0016): gone from them, but it was saved. */
  spent: number
  /** Everything put aside for it: what's there plus what was spent from it. Measures the target. */
  putAside: number
  /** 0 for an open-ended goal. */
  remaining: number
  /** 0–1 of the target; null for an open-ended goal. */
  progress: number | null
  /** Where the money for it is. */
  funding: { account: SavingsAccount; amount: number }[]
  /** Average net saved for it per month over the last complete months. */
  pace: number
  status: GoalStatus
}

/** Months looked back over for a goal's pace. */
const PACE_MONTHS = 3
/** Within this share of what's needed still counts as on track. */
const ON_TRACK = 0.95

/**
 * Net money put toward a goal per month, over the last complete months:
 * deposits into it minus withdrawals from it. Interest and transfers between
 * accounts don't count; they don't change what was put aside.
 */
export function goalPace(
  movements: SavingsMovement[],
  goalId: string,
  now = currentMonthKey(),
): number {
  const from = shiftMonth(now, -PACE_MONTHS)
  const net = movements
    .filter(
      (m) =>
        m.goal_id === goalId &&
        (m.kind === 'deposit' || m.kind === 'withdrawal') &&
        monthKeyOfDate(m.movement_date) >= from &&
        monthKeyOfDate(m.movement_date) < now,
    )
    .reduce((s, m) => s + m.amount, 0)
  return roundMoney(net / PACE_MONTHS)
}

export function goalSummaries(args: {
  goals: Goal[]
  accounts: SavingsAccount[]
  movements: SavingsMovement[]
  allocations: Allocation[]
  now?: MonthKey
}): GoalSummary[] {
  const { goals, accounts, movements, allocations, now = currentMonthKey() } = args
  const byId = new Map(accounts.map((a) => [a.id, a]))

  return goals.map((goal) => {
    const funding = allocations
      .filter((a) => a.goal_id === goal.id && byId.has(a.account_id))
      .map((a) => ({ account: byId.get(a.account_id)!, amount: a.amount }))
      .sort((a, b) => b.amount - a.amount)
    const saved = roundMoney(funding.reduce((s, f) => s + f.amount, 0))
    const spent = spentFromGoal(movements, goal.id)
    const putAside = roundMoney(saved + spent)
    const target = goal.target_amount
    const remaining = target > 0 ? roundMoney(Math.max(target - putAside, 0)) : 0
    const pace = goalPace(movements, goal.id, now)
    return {
      goal,
      saved,
      spent,
      putAside,
      remaining,
      progress: target > 0 ? Math.min(putAside / target, 1) : null,
      funding,
      pace,
      status: goalStatus({
        target,
        saved: putAside,
        remaining,
        pace,
        targetDate: goal.target_date,
        now,
      }),
    }
  })
}

/**
 * Spent from a goal's share of the accounts: the 'spending' movements the
 * database books for its expenses (migration 0016). What an expense took from
 * unassigned money, when the goal had too little, carries no goal.
 */
export function spentFromGoal(movements: SavingsMovement[], goalId: string): number {
  return roundMoney(
    movements
      .filter((m) => m.kind === 'spending' && m.goal_id === goalId)
      .reduce((s, m) => s - m.amount, 0),
  )
}

/**
 * What's left to spend from a goal, given everything put aside for it
 * (GoalSummary.putAside, which spending doesn't lower: it stays the measure
 * of reaching the target) and all that's been spent from it. `left` goes
 * negative when more has been spent than put aside; `share` is 0–1 of it.
 */
export function goalUse(saved: number, spent: number): { left: number; share: number } {
  const left = roundMoney(saved - spent)
  return { left, share: saved > 0 ? Math.min(Math.max(left / saved, 0), 1) : 0 }
}

export function goalStatus(args: {
  target: number
  saved: number
  remaining: number
  pace: number
  targetDate: string | null
  now: MonthKey
}): GoalStatus {
  const { target, saved, remaining, pace, targetDate, now } = args
  if (target <= 0) return { kind: 'open' }
  if (saved >= target) return { kind: 'reached' }
  if (!targetDate) {
    return { kind: 'no-date', eta: pace > 0 ? shiftMonth(now, Math.ceil(remaining / pace)) : null }
  }
  // months in which money can still go in before the target month
  const monthsLeft = monthsBetween(now, monthKeyOfDate(targetDate))
  if (monthsLeft <= 0) return { kind: 'overdue', shortfall: remaining }
  const neededPerMonth = roundMoney(remaining / monthsLeft)
  if (pace >= neededPerMonth * ON_TRACK) return { kind: 'on-track', neededPerMonth }
  return {
    kind: 'behind',
    neededPerMonth,
    shortfall: roundMoney(Math.max(remaining - Math.max(pace, 0) * monthsLeft, 0)),
  }
}

/** What the dated goals together need per month to be on time. */
export function totalNeededPerMonth(goals: GoalSummary[]): number {
  return roundMoney(
    goals.reduce(
      (s, g) =>
        s +
        (g.status.kind === 'on-track' || g.status.kind === 'behind' ? g.status.neededPerMonth : 0),
      0,
    ),
  )
}

/* ---------- over time ---------- */

/**
 * Put aside in a month: deposits minus withdrawals, across all accounts.
 * Interest, balance corrections and transfers between accounts aren't money
 * you saved, so they're left out; this is what compares with the plan.
 */
export function savedInMonth(movements: SavingsMovement[], month: MonthKey): number {
  return roundMoney(
    movements
      .filter(
        (m) =>
          (m.kind === 'deposit' || m.kind === 'withdrawal') &&
          monthKeyOfDate(m.movement_date) === month,
      )
      .reduce((s, m) => s + m.amount, 0),
  )
}

export interface BalancePoint {
  month: MonthKey
  /** Balance at the end of the month. */
  balance: number
  /** Of which interest earned so far. */
  interest: number
}

/** Month-end balances over `months` (oldest first), of all the given movements together. */
export function balanceHistory(movements: SavingsMovement[], months: MonthKey[]): BalancePoint[] {
  const sorted = [...movements].sort((a, b) => a.movement_date.localeCompare(b.movement_date))
  let i = 0
  let balance = 0
  let interest = 0
  return months.map((month) => {
    while (i < sorted.length && monthKeyOfDate(sorted[i].movement_date) <= month) {
      balance += sorted[i].amount
      if (sorted[i].kind === 'interest') interest += sorted[i].amount
      i++
    }
    return { month, balance: roundMoney(balance), interest: roundMoney(interest) }
  })
}

/**
 * Balance after each of the next `months`, putting in `monthly` and earning
 * `ratePct` a year, compounded monthly (how most Polish savings accounts pay).
 * An estimate: rates change, and tax on interest (19%) is left to the bank.
 */
export function projectBalance(
  balance: number,
  ratePct: number | null,
  monthly: number,
  months: number,
): number[] {
  const r = (ratePct ?? 0) / 100 / 12
  const out: number[] = []
  let b = balance
  for (let k = 0; k < months; k++) {
    b = b * (1 + r) + monthly
    out.push(roundMoney(b))
  }
  return out
}

/** A starting point for an emergency fund: this many months of typical spending. */
export const EMERGENCY_MONTHS = 3

/**
 * What an account's money did by itself: interest, and the corrections made
 * when its balance was updated to what the bank or broker shows (an IKE's
 * bonds or funds moving up or down). What you put in or took out, and the
 * balance an account started with, aren't part of it.
 */
export function accountGain(movements: SavingsMovement[]): { putIn: number; gain: number } {
  let putIn = 0
  let gain = 0
  for (const m of movements) {
    const started = m.kind === 'adjustment' && isStartingPoint(m.note)
    if (m.kind === 'interest' || (m.kind === 'adjustment' && !started)) gain += m.amount
    else putIn += m.amount
  }
  return { putIn: roundMoney(putIn), gain: roundMoney(gain) }
}

/** An adjustment that says how much was there to begin with, not a change in value. */
function isStartingPoint(note: string | null): boolean {
  return !!note && /^opening balance$|saved amount corrected$/i.test(note.trim())
}
