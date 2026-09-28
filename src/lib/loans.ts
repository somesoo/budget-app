import type { AccountSummary, GoalSummary } from './savings'
import type { PlanAllocation, SavingsLoan, SavingsMovement } from '../types'
import { monthKeyOfDate, roundMoney, type MonthKey } from './calculations'
import { roundUpPlan } from './planning'

/*
 * Borrowing from yourselves: money taken out of savings for a need that
 * couldn't wait, paid back in monthly instalments. A loan is open until the
 * deposits marked with its id add up to what was taken.
 */

export interface LoanSummary {
  loan: SavingsLoan
  repaid: number
  remaining: number
  /** What the next month's plan pays back: the instalment, or what's left if less. */
  nextInstalment: number
}

export function loanSummaries(loans: SavingsLoan[], movements: SavingsMovement[]): LoanSummary[] {
  return loans.map((loan) => {
    const repaid = roundMoney(
      movements
        .filter((m) => m.loan_id === loan.id && m.amount > 0)
        .reduce((s, m) => s + m.amount, 0),
    )
    const remaining = roundMoney(Math.max(loan.amount - repaid, 0))
    return { loan, repaid, remaining, nextInstalment: Math.min(loan.monthly, remaining) }
  })
}

export const openLoans = (loans: LoanSummary[]) => loans.filter((l) => l.remaining > 0)

/** A monthly instalment that pays `amount` back in `months`, rounded up to 10 zł. */
export function instalment(amount: number, months: number): number {
  return Math.min(roundUpPlan(amount / Math.max(months, 1)), roundMoney(amount))
}

/** A plan line paying back one instalment of each open loan. */
export function loanLines(loans: LoanSummary[]): PlanAllocation[] {
  return openLoans(loans).map((l) => ({
    account_id: l.loan.account_id,
    goal_id: l.loan.goal_id,
    loan_id: l.loan.id,
    amount: l.nextInstalment,
  }))
}

/** Paid back toward a loan in a month. */
export function repaidInMonth(movements: SavingsMovement[], loanId: string, month: MonthKey) {
  return roundMoney(
    movements
      .filter(
        (m) => m.loan_id === loanId && m.amount > 0 && monthKeyOfDate(m.movement_date) === month,
      )
      .reduce((s, m) => s + m.amount, 0),
  )
}

/* ---------- where to borrow from ---------- */

export interface BorrowSource {
  account: AccountSummary['account']
  /** Null: what's unassigned on the account. */
  goal: GoalSummary | null
  available: number
  /** Why it's suggested in this order, in a few words. */
  reason: string
  /** For a dated goal: what it would need a month afterwards, to still be on time. */
  neededAfter: number | null
}

/**
 * Everywhere the money could come from, the least painful first: money no goal
 * is waiting for, then goals without a deadline, then dated goals with the
 * furthest deadline first. A source that can't cover `amount` on its own goes
 * after those that can.
 */
export function borrowSources(
  accounts: AccountSummary[],
  goals: GoalSummary[],
  amount: number,
): BorrowSource[] {
  const goalById = new Map(goals.map((g) => [g.goal.id, g]))
  const ranked: { source: BorrowSource; rank: number; date: string }[] = []

  for (const a of accounts) {
    if (a.account.archived) continue
    if (a.unassigned > 0) {
      ranked.push({
        source: {
          account: a.account,
          goal: null,
          available: a.unassigned,
          reason: 'not set aside for any goal',
          neededAfter: null,
        },
        rank: 0,
        date: '',
      })
    }
    for (const [goalId, share] of Object.entries(a.byGoal)) {
      const g = goalById.get(goalId)
      if (!g || share <= 0) continue
      const dated = g.goal.target_date !== null && g.goal.target_amount > 0
      const taken = Math.min(amount, share)
      // what's left to save grows by what's taken, over the same months
      const neededAfter =
        (g.status.kind === 'on-track' || g.status.kind === 'behind') && g.remaining > 0
          ? roundMoney((g.status.neededPerMonth * (g.remaining + taken)) / g.remaining)
          : null
      ranked.push({
        source: {
          account: a.account,
          goal: g,
          available: share,
          reason: dated ? `due ${g.goal.target_date!.slice(0, 7)}` : 'no deadline',
          neededAfter,
        },
        rank: dated ? 2 : 1,
        // furthest deadline first
        date: g.goal.target_date ?? '',
      })
    }
  }

  return ranked
    .sort(
      (x, y) =>
        Number(y.source.available >= amount) - Number(x.source.available >= amount) ||
        x.rank - y.rank ||
        y.date.localeCompare(x.date) ||
        y.source.available - x.source.available,
    )
    .map((r) => r.source)
}

/* ---------- moving a whole account ---------- */

export interface MoveStep {
  goalId: string | null
  amount: number
}

/**
 * The transfers that empty an account into another while keeping every goal's
 * share: one per goal, then one for what's unassigned. Nothing for a balance
 * at or below zero.
 */
export function emptyAccountSteps(summary: AccountSummary): MoveStep[] {
  if (summary.balance <= 0) return []
  const steps: MoveStep[] = Object.entries(summary.byGoal)
    .filter(([, amount]) => amount > 0)
    .map(([goalId, amount]) => ({ goalId, amount }))
  if (summary.unassigned > 0) steps.push({ goalId: null, amount: summary.unassigned })
  return steps
}

/* ---------- correcting goal shares ---------- */

/**
 * The allocation changes that turn an account's goal shares into `target`
 * without touching its balance: every decrease first, so the increases always
 * have unassigned money to draw on. Throws if the target is more than the
 * balance.
 */
export function shareChanges(
  summary: AccountSummary,
  target: Record<string, number>,
): { goalId: string; delta: number }[] {
  const total = roundMoney(Object.values(target).reduce((s, v) => s + Math.max(v, 0), 0))
  if (total > summary.balance + 0.001) {
    throw new Error(
      `That sets aside ${total} but the account only has ${summary.balance}. Lower a goal's share.`,
    )
  }
  const ids = new Set([...Object.keys(summary.byGoal), ...Object.keys(target)])
  const changes = [...ids]
    .map((goalId) => ({
      goalId,
      delta: roundMoney(Math.max(target[goalId] ?? 0, 0) - (summary.byGoal[goalId] ?? 0)),
    }))
    .filter((c) => c.delta !== 0)
  return [...changes.filter((c) => c.delta < 0), ...changes.filter((c) => c.delta > 0)]
}
