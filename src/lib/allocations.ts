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

/** Identifies a line: a loan instalment, a goal, or an account paid into directly. */
export const allocationKey = (a: Pick<PlanAllocation, 'goal_id' | 'account_id' | 'loan_id'>) =>
  a.loan_id ? `loan:${a.loan_id}` : a.goal_id ? `goal:${a.goal_id}` : `account:${a.account_id}`

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
  /** Paid into savings this month (see monthSavingsFlow); more than planned leaves less to spend. */
  deposited?: number
  /** Taken out of savings this month: money back in hand to spend. */
  withdrawn?: number
  /** Fixed costs not paid yet this month (see unpaidFixedCosts): already spoken for. */
  reserved?: number
}): {
  amount: number
  income: number
  expected: boolean
  savedAside: number
  reserved: number
} | null {
  const expected = args.income <= 0
  const income = expected ? args.plannedIncome : args.income
  if (income <= 0) return null
  const savedAside = savedAsideOf(args)
  const reserved = roundMoney(args.reserved ?? 0)
  return {
    amount: roundMoney(income - savedAside - args.spent - reserved),
    income,
    expected,
    savedAside,
    reserved,
  }
}

/**
 * What the month's fixed costs (rent, bills: the categories kept out of the
 * spending chart) still have to take: each one's limit less what it has cost
 * so far. Until the rent is paid, its money isn't free to spend.
 */
export function unpaidFixedCosts(
  categories: { id: string; monthly_limit: number; show_in_chart: boolean; archived: boolean }[],
  spentByCategory: Record<string, number>,
): number {
  return roundMoney(
    categories
      .filter((c) => !c.show_in_chart && !c.archived)
      .reduce((s, c) => s + Math.max(c.monthly_limit - (spentByCategory[c.id] ?? 0), 0), 0),
  )
}

/**
 * What the month puts aside, net: the plan's savings are spoken for until
 * paid in, anything paid in beyond them counts too, and money taken back out
 * is back in hand.
 */
function savedAsideOf(args: { savings: number; deposited?: number; withdrawn?: number }) {
  return roundMoney(Math.max(args.savings, args.deposited ?? 0) - (args.withdrawn ?? 0))
}

/**
 * What a month didn't spend: logged income, minus what it put aside (as in
 * safeToSpend), minus its spending. Null when no income was logged, since
 * there's nothing to go on.
 */
export function monthLeftover(args: {
  income: number
  savings: number
  spent: number
  deposited?: number
  withdrawn?: number
}) {
  if (args.income <= 0) return null
  return roundMoney(args.income - savedAsideOf(args) - args.spent)
}

/**
 * Money that went into and came out of savings in a month, from the month's
 * own income: deposits (not interest, not transfers between accounts, and not
 * the month before's leftover, which came from that month's income) and
 * withdrawals.
 */
export function monthSavingsFlow(movements: SavingsMovement[], month: MonthKey) {
  let deposited = 0
  let withdrawn = 0
  for (const m of movements) {
    if (monthKeyOfDate(m.movement_date) !== month) continue
    if (m.kind === 'deposit' && !isLeftover(m)) deposited += m.amount
    else if (m.kind === 'withdrawal') withdrawn -= m.amount
  }
  return { deposited: roundMoney(deposited), withdrawn: roundMoney(withdrawn) }
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
  const planGoals = new Set(
    lines.flatMap((l) => (l.goal_id && !l.loan_id ? [l.goal_id] : [])),
  )
  // last month's leftover has its own line (see leftoverPaid), and so does a loan's instalment
  const inMonth = movements.filter(
    (m) => isPaidIn(m) && monthKeyOfDate(m.movement_date) === month && !isLeftover(m),
  )
  const countsFor = (line: PlanAllocation, m: SavingsMovement) => {
    if (line.loan_id) return m.loan_id === line.loan_id
    if (m.loan_id) return false
    // a transfer moves a goal's money between accounts, it doesn't add any
    if (line.goal_id) return m.goal_id === line.goal_id && m.kind === 'deposit'
    // money moved onto an IKE from savings still counts toward paying into it
    return m.account_id === line.account_id && !(m.goal_id && planGoals.has(m.goal_id))
  }
  return lines.map((line) => {
    const paid = roundMoney(
      inMonth.filter((m) => countsFor(line, m)).reduce((s, m) => s + m.amount, 0),
    )
    return { line, paid, remaining: roundMoney(Math.max(line.amount - paid, 0)) }
  })
}

/* ---------- how healthy the month is ---------- */

export type Health = 'good' | 'watch' | 'low'

export interface MoneyHealth {
  /** What the month puts aside, as a share of its income; null without income. */
  savingsRate: { value: number; health: Health } | null
  /** Rent, bills and other fixed costs, as a share of income; null without income. */
  fixedShare: { value: number; health: Health } | null
  /** Months of typical spending the emergency fund covers; null without one. */
  emergencyMonths: { value: number; health: Health } | null
}

/**
 * The three numbers that say most about a household's money, each against
 * the usual rules of thumb: save 20% or more of income, keep fixed costs
 * under half of it, and hold three to six months of spending in reserve.
 */
export function moneyHealth(args: {
  income: number
  savedAside: number
  fixedCosts: number
  emergencySaved: number | null
  typicalSpending: number | null
}): MoneyHealth {
  const { income, savedAside, fixedCosts, emergencySaved, typicalSpending } = args
  const rate = income > 0 ? savedAside / income : null
  const fixed = income > 0 ? fixedCosts / income : null
  const months =
    emergencySaved !== null && typicalSpending !== null && typicalSpending > 0
      ? emergencySaved / typicalSpending
      : null
  return {
    savingsRate:
      rate === null
        ? null
        : { value: rate, health: rate >= 0.2 ? 'good' : rate >= 0.1 ? 'watch' : 'low' },
    fixedShare:
      fixed === null
        ? null
        : { value: fixed, health: fixed <= 0.5 ? 'good' : fixed <= 0.6 ? 'watch' : 'low' },
    emergencyMonths:
      months === null
        ? null
        : { value: months, health: months >= 3 ? 'good' : months >= 1 ? 'watch' : 'low' },
  }
}
