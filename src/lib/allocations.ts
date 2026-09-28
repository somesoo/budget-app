import { RETIREMENT_LIMITS } from '../config'
import type { GoalSummary } from './savings'
import type { PlanAllocation, SavingsAccount, SavingsMovement } from '../types'
import { monthKeyOfDate, roundMoney, type MonthKey } from './calculations'
import { roundUpPlan } from './planning'

/*
 * Paying the paycheck out: a month's plan splits its savings between goals
 * and IKE/IKZE accounts. `plan.savings` stays the total; what the lines don't
 * cover is "other savings".
 */

export const isRetirementWrapper = (a: SavingsAccount): a is SavingsAccount & {
  kind: 'ike' | 'ikze'
} => a.kind === 'ike' || a.kind === 'ikze'

/** Identifies a line: a goal, or an account paid into directly. */
export const allocationKey = (a: Pick<PlanAllocation, 'goal_id' | 'account_id'>) =>
  a.goal_id ? `goal:${a.goal_id}` : `account:${a.account_id}`

export const sumAllocations = (lines: PlanAllocation[]) =>
  roundMoney(lines.reduce((s, a) => s + a.amount, 0))

/** Savings the lines don't place anywhere; negative if they add up to more than the total. */
export const otherSavings = (savings: number, lines: PlanAllocation[]) =>
  roundMoney(savings - sumAllocations(lines))

/**
 * Sets one line's amount (0 removes it). The total follows, so what's in
 * "other savings" stays where it was.
 */
export function setAllocation(
  draft: { savings: number; allocations: PlanAllocation[] },
  line: Omit<PlanAllocation, 'amount'>,
  amount: number,
): { savings: number; allocations: PlanAllocation[] } {
  const key = allocationKey(line)
  const other = otherSavings(draft.savings, draft.allocations)
  const rest = draft.allocations.filter((a) => allocationKey(a) !== key)
  const allocations = amount > 0 ? [...rest, { ...line, amount }] : rest
  return { savings: roundMoney(Math.max(other, 0) + sumAllocations(allocations)), allocations }
}

/** The account a goal's money goes to by default: where most of it already is, else the first savings account. */
export function defaultGoalAccount(goal: GoalSummary, accounts: SavingsAccount[]): string | null {
  if (goal.funding[0]) return goal.funding[0].account.id
  const open = accounts.filter((a) => !a.archived)
  return (open.find((a) => !isRetirementWrapper(a)) ?? open[0])?.id ?? null
}

/**
 * Last month's lines carried into a new plan, minus those whose goal or
 * account has since been closed.
 */
export function carryAllocations(
  lines: PlanAllocation[],
  openGoalIds: Set<string>,
  openAccountIds: Set<string>,
): PlanAllocation[] {
  return lines.filter(
    (a) =>
      (a.goal_id === null || openGoalIds.has(a.goal_id)) &&
      (a.account_id === null ? a.goal_id !== null : openAccountIds.has(a.account_id)),
  )
}

/* ---------- IKE / IKZE yearly limit ---------- */

/** The year's limit; for a year not yet in config, the latest known one. */
export function retirementLimit(kind: 'ike' | 'ikze', year: number): { amount: number; year: number } {
  const table = RETIREMENT_LIMITS[kind]
  if (table[year] !== undefined) return { amount: table[year], year }
  const known = Object.keys(table).map(Number).sort((a, b) => a - b)
  const fallback = known.filter((y) => y <= year).pop() ?? known[known.length - 1]
  return { amount: table[fallback], year: fallback }
}

/**
 * Money paid onto an account: deposits and transfers in. Interest and balance
 * corrections aren't contributions, and taking money out doesn't give an
 * IKE's limit back, so withdrawals don't count against them.
 */
const isPaidIn = (m: SavingsMovement) =>
  m.amount > 0 && (m.kind === 'deposit' || m.kind === 'transfer')

/** Paid onto an account in `year`, before month `before` if given. */
export function contributedInYear(
  movements: SavingsMovement[],
  accountId: string,
  year: number,
  before?: MonthKey,
): number {
  const prefix = String(year)
  return roundMoney(
    movements
      .filter(
        (m) =>
          m.account_id === accountId &&
          isPaidIn(m) &&
          m.movement_date.startsWith(prefix) &&
          (before === undefined || monthKeyOfDate(m.movement_date) < before),
      )
      .reduce((s, m) => s + m.amount, 0),
  )
}

export interface RetirementStatus {
  limit: number
  /** The year the limit is from; differs from the month's year when that one isn't known yet. */
  limitYear: number
  /** Paid in this year so far, not counting the planned month. */
  contributed: number
  /** Paid in during the planned month itself (it may be under way). */
  thisMonth: number
  /** Left of the limit before the planned month. */
  room: number
  /** Monthly payment from the planned month to December that uses up the room, rounded up to 10 zł. */
  toMaxOut: number
  /** Months from the planned one to December, inclusive. */
  monthsLeft: number
}

export function retirementStatus(
  account: SavingsAccount & { kind: 'ike' | 'ikze' },
  movements: SavingsMovement[],
  month: MonthKey,
): RetirementStatus {
  const year = Number(month.slice(0, 4))
  const monthsLeft = 13 - Number(month.slice(5))
  const { amount: limit, year: limitYear } = retirementLimit(account.kind, year)
  const contributed = contributedInYear(movements, account.id, year, month)
  const thisMonth = roundMoney(
    movements
      .filter(
        (m) =>
          m.account_id === account.id && isPaidIn(m) && monthKeyOfDate(m.movement_date) === month,
      )
      .reduce((s, m) => s + m.amount, 0),
  )
  const room = roundMoney(Math.max(limit - contributed, 0))
  return {
    limit,
    limitYear,
    contributed,
    thisMonth,
    room,
    toMaxOut: room > 0 ? Math.min(roundUpPlan(room / monthsLeft), roundMoney(room)) : 0,
    monthsLeft,
  }
}

/* ---------- what's safe to spend, and what's left ---------- */

/**
 * The month's money that can still be spent: what came in, minus what the
 * plan sends to savings (paid in yet or not: it's spoken for), minus what's
 * been spent. Before a paycheck is logged, the plan's income stands in for it.
 * Each month starts from its own income, because what the one before didn't
 * spend goes to a goal.
 */
export function safeToSpend(args: {
  /** Logged this month. */
  income: number
  /** The plan's expected income; 0 without a plan. */
  plannedIncome: number
  /** The plan's savings total; 0 without a plan. */
  savings: number
  /** Monthly spending, trips left out. */
  spent: number
}): { amount: number; income: number; expected: boolean } | null {
  const expected = args.income <= 0
  const income = expected ? args.plannedIncome : args.income
  if (income <= 0) return null
  return { amount: roundMoney(income - args.savings - args.spent), income, expected }
}

/**
 * What a month didn't spend: logged income, minus its planned savings, minus
 * its spending. Null when no income was logged, since there's nothing to go on.
 */
export function monthLeftover(args: { income: number; savings: number; spent: number }) {
  if (args.income <= 0) return null
  return roundMoney(args.income - args.savings - args.spent)
}

const LEFTOVER_PREFIX = 'Leftover from '

/** The note a leftover deposit carries: how it's told apart from the plan's own lines. */
export const leftoverNote = (monthName: string) => `${LEFTOVER_PREFIX}${monthName}`

const isLeftover = (m: SavingsMovement) => m.note?.startsWith(LEFTOVER_PREFIX) ?? false

/** Paid in as `note` (see leftoverNote) toward `goalId`. */
export function leftoverPaid(movements: SavingsMovement[], goalId: string, note: string): number {
  return roundMoney(
    movements
      .filter((m) => m.goal_id === goalId && m.kind === 'deposit' && m.note === note)
      .reduce((s, m) => s + m.amount, 0),
  )
}

/* ---------- the plan against what happened ---------- */

export interface AllocationProgress {
  line: PlanAllocation
  /** Paid in during the month toward this line. */
  paid: number
  /** Still to pay in; 0 once done. */
  remaining: number
}

/**
 * Each line of a month's plan against the month's movements. A goal line
 * counts money put toward that goal on any account; an account line counts
 * money onto the account that wasn't for one of the plan's goals.
 */
export function allocationProgress(
  lines: PlanAllocation[],
  movements: SavingsMovement[],
  month: MonthKey,
): AllocationProgress[] {
  const planGoals = new Set(lines.flatMap((l) => (l.goal_id ? [l.goal_id] : [])))
  // last month's leftover has its own line, see leftoverPaid
  const inMonth = movements.filter(
    (m) => isPaidIn(m) && monthKeyOfDate(m.movement_date) === month && !isLeftover(m),
  )
  return lines.map((line) => {
    const paid = roundMoney(
      inMonth
        .filter((m) =>
          line.goal_id
            ? // a transfer moves a goal's money between accounts, it doesn't add any
              m.goal_id === line.goal_id && m.kind === 'deposit'
            : // money moved onto an IKE from savings still counts toward paying into it
              m.account_id === line.account_id && !(m.goal_id && planGoals.has(m.goal_id)),
        )
        .reduce((s, m) => s + m.amount, 0),
    )
    return { line, paid, remaining: roundMoney(Math.max(line.amount - paid, 0)) }
  })
}
