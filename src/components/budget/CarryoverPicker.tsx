import { ArrowBendDownRight } from '@phosphor-icons/react'
import type { SavingsOverview } from '../../hooks/useSavings'
import { defaultGoalAccount } from '../../lib/allocations'
import { formatMoneyCompact, formatMonthName, type MonthKey } from '../../lib/calculations'
import type { PlanCarryover } from '../../types'

/**
 * Planning a month asks where the month before's unspent money goes: one of
 * the goals, or nowhere (it stays on the account). The money itself moves at
 * the start of the planned month, from the Budget tab's "From the paycheck".
 */
export function CarryoverPicker({
  prevMonth,
  leftover,
  final,
  value,
  onChange,
  overview,
}: {
  prevMonth: MonthKey
  /** Null when the month has no income logged. */
  leftover: number | null
  final: boolean
  value: PlanCarryover | null
  onChange: (next: PlanCarryover | null) => void
  overview: SavingsOverview
}) {
  const goals = overview.goals.filter((g) => !g.goal.archived || g.goal.id === value?.goal_id)
  if (!overview.available || goals.length === 0) return null

  const accounts = overview.accounts.map((a) => a.account)
  const name = formatMonthName(prevMonth)
  const status =
    leftover === null
      ? `No income logged in ${name} yet, so nothing to go on.`
      : leftover <= 0
        ? `${name} has nothing left${final ? '' : ' so far'}${
            leftover < 0 ? ` (${formatMoneyCompact(Math.round(-leftover))} over)` : ''
          }.`
        : `${formatMoneyCompact(Math.floor(leftover))} left${final ? '' : ' so far; the final amount is known at the end of the month'}.`

  return (
    <section
      aria-labelledby="plan-carryover"
      className={`rounded-3xl p-4 ring-1 ${
        value ? 'bg-white/5 ring-white/10' : 'bg-amber-400/10 ring-amber-300/30'
      }`}
    >
      <h2
        id="plan-carryover"
        className="flex items-center gap-1.5 text-base font-semibold text-white"
      >
        <ArrowBendDownRight aria-hidden />
        What {name} doesn’t spend goes to
      </h2>
      <p className="mt-1 text-sm text-slate-300">
        Income, minus planned savings, minus spending. {status}
      </p>
      <select
        value={value?.goal_id ?? ''}
        onChange={(e) => {
          const g = goals.find((x) => x.goal.id === e.target.value)
          onChange(g ? { goal_id: g.goal.id, account_id: defaultGoalAccount(g, accounts) } : null)
        }}
        aria-label={`Goal for what ${name} doesn’t spend`}
        className="mt-3 w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] text-white outline-none ring-1 ring-white/10 focus:ring-white/40"
      >
        <option value="">Pick a goal… (or leave it on the account)</option>
        {goals.map((g) => (
          <option key={g.goal.id} value={g.goal.id}>
            {g.goal.name}
            {g.remaining > 0 ? ` · ${formatMoneyCompact(Math.round(g.remaining))} to go` : ''}
          </option>
        ))}
      </select>
      {!value && (
        <p className="mt-2 text-xs text-amber-200">
          Not chosen: whatever’s left stays on the account and is easy to spend.
        </p>
      )}
    </section>
  )
}
