import { Check } from '@phosphor-icons/react'
import { useState } from 'react'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useMonthMoney } from '../../hooks/useMonthMoney'
import { useSavingsActions, type SavingsOverview } from '../../hooks/useSavings'
import {
  allocationKey,
  allocationProgress,
  leftoverNote,
  leftoverPaid,
  otherSavings,
} from '../../lib/allocations'
import {
  currentMonthKey,
  formatMoneyCompact,
  formatMonthName,
  roundMoney,
  shiftMonth,
  type MonthKey,
} from '../../lib/calculations'
import type { BudgetPlan, SavingsAccount, SavingsLoan } from '../../types'

interface Row {
  key: string
  name: string
  color: string
  sub: string
  planned: number
  paid: number
  remaining: number
  account: SavingsAccount | undefined
  goalId: string | null
  /** For an instalment: the loan it pays back. */
  loan?: SavingsLoan
  /** Closed goal or account, or a month that isn't running: nothing to pay in from here. */
  payable: boolean
  note: string
  /** Shown instead of a button when there's nothing to pay yet. */
  waiting?: string
}

/**
 * The month's plan for its savings against what has been paid in: each goal
 * and IKE line, and last month's unspent money for the goal picked while
 * planning, with a tick once done. In the running month, one button (tap,
 * then confirm) books what's left of a line as a deposit.
 */
export function PaycheckCard({
  month,
  plan,
  overview,
  bare = false,
}: {
  month: MonthKey
  plan: BudgetPlan
  overview: SavingsOverview
  /** Without its own card and title: inside a sheet that has them. */
  bare?: boolean
}) {
  const { saveTo, repay } = useSavingsActions()
  const { person } = useDeviceUser()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prevMonth = shiftMonth(month, -1)
  const previous = useMonthMoney(prevMonth)

  if (!overview.available) return null

  const isCurrent = month === currentMonthKey()
  const goalById = new Map(overview.goals.map((g) => [g.goal.id, g.goal]))
  const accountById = new Map(overview.accounts.map((a) => [a.account.id, a.account]))
  const loanById = new Map(overview.loans.map((l) => [l.loan.id, l.loan]))

  const rows: Row[] = allocationProgress(plan.allocations, overview.movements, month).map(
    ({ line, paid, remaining }) => {
      const goal = line.goal_id ? goalById.get(line.goal_id) : undefined
      const account = line.account_id ? accountById.get(line.account_id) : undefined
      const loan = line.loan_id ? loanById.get(line.loan_id) : undefined
      if (line.loan_id) {
        return {
          key: allocationKey(line),
          name: `Pay back: ${loan?.note ?? 'a loan'}`,
          color: '#f59e0b',
          sub: `to ${goal?.name ?? account?.name ?? 'savings'}`,
          planned: line.amount,
          paid,
          remaining,
          account,
          goalId: line.goal_id,
          loan,
          payable: !!loan && !!account && !account.archived,
          note: `Paid back: ${loan?.note ?? ''}`,
        }
      }
      return {
        key: allocationKey(line),
        name: goal?.name ?? account?.name ?? 'Closed',
        color: goal?.color ?? account?.color ?? '#64748b',
        sub: goal
          ? account
            ? `onto ${account.name}`
            : 'no account chosen'
          : account && (account.kind === 'ike' || account.kind === 'ikze')
            ? account.kind.toUpperCase()
            : 'account',
        planned: line.amount,
        paid,
        remaining,
        account,
        goalId: line.goal_id,
        payable: !!account && !account.archived && !goal?.archived,
        note: `${formatMonthName(month)} plan`,
      }
    },
  )

  // last month's unspent money, to the goal chosen while planning this one
  const carry = plan.carryover
  const carryGoal = carry ? goalById.get(carry.goal_id) : undefined
  if (carry && carryGoal && previous.leftover !== null && previous.leftover > 0) {
    const account = carry.account_id ? accountById.get(carry.account_id) : undefined
    const note = leftoverNote(formatMonthName(prevMonth))
    const amount = Math.floor(previous.leftover)
    const paid = leftoverPaid(overview.movements, carry.goal_id, note)
    rows.push({
      key: 'leftover',
      name: carryGoal.name,
      color: carryGoal.color,
      sub: `unspent in ${formatMonthName(prevMonth)}${account ? ` · onto ${account.name}` : ''}`,
      planned: amount,
      paid,
      remaining: roundMoney(Math.max(amount - paid, 0)),
      account,
      goalId: carry.goal_id,
      payable: !!account && !account.archived && !carryGoal.archived,
      note,
      waiting: previous.final ? undefined : `at the end of ${formatMonthName(prevMonth)}`,
    })
  }

  if (rows.length === 0) return null

  const other = otherSavings(plan.savings, plan.allocations)
  const done = rows.filter((r) => r.remaining === 0).length

  const payIn = (row: Row) => {
    setError(null)
    const done = {
      onSuccess: () => setConfirming((c) => (c === row.key ? null : c)),
      onError: (e: unknown) => setError((e as Error).message),
    }
    if (row.loan) repay.mutate({ loan: row.loan, amount: row.remaining, person }, done)
    else
      saveTo.mutate(
        { account: row.account!.id, amount: row.remaining, goal: row.goalId, person, note: row.note },
        done,
      )
  }

  const list = (
    <>
      <ul className="divide-y divide-white/5">
        {rows.map((row) => {
          const canPay = isCurrent && row.remaining > 0 && row.payable && !row.waiting
          return (
            <li key={row.key} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-white">{row.name}</p>
                <p className="truncate text-xs tabular-nums text-muted">
                  {row.sub} · {formatMoneyCompact(row.paid)} of {formatMoneyCompact(row.planned)}
                </p>
              </div>
              {row.remaining === 0 ? (
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-positive">
                  <Check weight="bold" aria-hidden /> Paid in
                </span>
              ) : canPay ? (
                <button
                  type="button"
                  disabled={saveTo.isPending || repay.isPending}
                  onClick={() => (confirming === row.key ? payIn(row) : setConfirming(row.key))}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ring-1 transition active:scale-[0.97] disabled:opacity-50 ${
                    confirming === row.key
                      ? 'bg-slate-50 text-ink ring-slate-50'
                      : 'text-accent-soft ring-accent/35 hover:bg-accent/10'
                  }`}
                >
                  {confirming === row.key
                    ? `Confirm ${formatMoneyCompact(row.remaining)}`
                    : `Pay in ${formatMoneyCompact(row.remaining)}`}
                </button>
              ) : (
                <span className="shrink-0 text-right text-sm tabular-nums text-amber-200">
                  {row.waiting ?? `${formatMoneyCompact(row.remaining)} to go`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {other > 0 && (
        <p className="mt-1 text-xs text-muted">
          Plus {formatMoneyCompact(other)} of other savings, anywhere you like.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-300">Not paid in: {error}</p>}
    </>
  )

  if (bare) return list

  return (
    <section className="mb-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-white">From the paycheck</h2>
        <span className="text-xs tabular-nums text-muted">
          {done} of {rows.length} done
        </span>
      </div>
      {list}
    </section>
  )
}
