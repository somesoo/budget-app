import { ArrowBendDownRight, Check } from '@phosphor-icons/react'
import type { SavingsOverview } from '../../hooks/useSavings'
import { defaultGoalAccount } from '../../lib/allocations'
import { formatMoneyCompact, formatMonthName, type MonthKey } from '../../lib/calculations'
import { evenShares, splitLeftover } from '../../lib/planning'
import type { PlanCarryover } from '../../types'

/**
 * Planning a month asks where the month before's unspent money goes: split
 * between any number of goals, evenly unless you change the percentages, or
 * nowhere (it stays on the account). The money itself moves at the start of
 * the planned month, from the Budget tab's "From the paycheck".
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
  value: PlanCarryover[]
  onChange: (next: PlanCarryover[]) => void
  overview: SavingsOverview
}) {
  const chosen = new Map(value.map((c) => [c.goal_id, c]))
  const goals = overview.goals.filter((g) => !g.goal.archived || chosen.has(g.goal.id))
  if (!overview.available) return null

  const accounts = overview.accounts.map((a) => a.account)
  const name = formatMonthName(prevMonth)
  const amount = leftover !== null && leftover > 0 ? leftover : 0
  const parts = splitLeftover(amount, value)
  const partOf = new Map(value.map((c, i) => [c.goal_id, parts[i]]))
  const total = value.reduce((s, c) => s + c.share, 0)
  const status =
    leftover === null
      ? `No income logged in ${name} yet, so nothing to go on.`
      : leftover <= 0
        ? `${name} has nothing left${final ? '' : ' so far'}${
            leftover < 0 ? ` (${formatMoneyCompact(Math.round(-leftover))} over)` : ''
          }.`
        : `${formatMoneyCompact(Math.floor(leftover))} left${final ? '' : ' so far; the final amount is known at the end of the month'}.`

  const toggle = (goalId: string) => {
    if (chosen.has(goalId)) {
      onChange(evenShares(value.filter((c) => c.goal_id !== goalId), true))
      return
    }
    const g = goals.find((x) => x.goal.id === goalId)
    if (!g) return
    // a new goal joins an even split
    onChange(
      evenShares(
        [...value, { goal_id: goalId, account_id: defaultGoalAccount(g, accounts), share: 0 }],
        true,
      ),
    )
  }
  const setShare = (goalId: string, share: number) =>
    onChange(
      value.map((c) =>
        c.goal_id === goalId ? { ...c, share: Math.max(0, Math.min(100, Math.round(share))) } : c,
      ),
    )

  return (
    <section
      aria-labelledby="plan-carryover"
      className={`rounded-3xl p-4 ring-1 ${
        value.length > 0 ? 'bg-white/5 ring-white/10' : 'bg-amber-400/10 ring-amber-300/30'
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
        Income, minus what was saved, minus spending. {status} Pick one goal or several; it’s
        split between them.
      </p>

      {goals.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No goals yet: add one on the Savings tab.</p>
      ) : (
        <ul className="mt-3 grid gap-1.5">
          {goals.map((g) => {
            const c = chosen.get(g.goal.id)
            return (
              <li
                key={g.goal.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${
                  c ? 'bg-white/10 ring-white/30' : 'ring-white/10'
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!c}
                  onClick={() => toggle(g.goal.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ${
                      c ? 'bg-slate-50 text-ink ring-slate-50' : 'ring-white/30'
                    }`}
                  >
                    {c && <Check weight="bold" className="text-xs" />}
                  </span>
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: g.goal.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-white">{g.goal.name}</span>
                    {g.remaining > 0 && (
                      <span className="block text-xs text-muted">
                        {formatMoneyCompact(Math.round(g.remaining))} to go
                      </span>
                    )}
                  </span>
                </button>
                {c && (
                  <div className="flex shrink-0 items-center gap-2">
                    {amount > 0 && (
                      <span className="text-xs tabular-nums text-slate-300">
                        {formatMoneyCompact(partOf.get(g.goal.id) ?? 0)}
                      </span>
                    )}
                    <label className="flex items-baseline gap-0.5 rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10 focus-within:ring-white/40">
                      <span className="sr-only">{g.goal.name}: share in percent</span>
                      <input
                        value={c.share}
                        onChange={(e) =>
                          setShare(g.goal.id, Number(e.target.value.replace(/\D/g, '')) || 0)
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        inputMode="numeric"
                        className="w-9 bg-transparent text-right text-[15px] font-semibold tabular-nums text-white outline-none"
                      />
                      <span className="text-xs text-muted">%</span>
                    </label>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {value.length > 1 && total !== 100 && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-amber-200">The parts add up to {total}%, not 100%.</span>
          <button
            type="button"
            onClick={() => onChange(evenShares(value, true))}
            className="shrink-0 rounded-full px-2.5 py-1 font-semibold text-accent-soft ring-1 ring-accent/35"
          >
            Split evenly
          </button>
        </div>
      )}
      {value.length === 0 && goals.length > 0 && (
        <p className="mt-2 text-xs text-amber-200">
          None picked: whatever’s left stays on the account and is easy to spend.
        </p>
      )}
    </section>
  )
}
