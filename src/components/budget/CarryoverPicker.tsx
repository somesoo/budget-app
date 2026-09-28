import { ArrowBendDownRight, Check } from '@phosphor-icons/react'
import type { SavingsOverview } from '../../hooks/useSavings'
import { defaultGoalAccount } from '../../lib/allocations'
import { MoneyInput } from './MoneyInput'
import { formatMoneyCompact, formatMonthName, type MonthKey } from '../../lib/calculations'
import { evenShares, isShare, splitLeftover } from '../../lib/planning'
import type { GoalSummary } from '../../lib/savings'
import type { PlanCarryover } from '../../types'

const monthYear = (date: string) => {
  const [y, m] = date.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/** A month's worth of what a dated goal needs, rounded up to 10 zł; null without a deadline. */
function need(g: GoalSummary): number | null {
  return g.status.kind === 'on-track' || g.status.kind === 'behind'
    ? Math.ceil(g.status.neededPerMonth / 10) * 10
    : null
}

/** What a dated goal still lacks a month once the plan's own payment is in; null without a deadline. */
function gap(g: GoalSummary, planned: number): number | null {
  const n = need(g)
  return n === null ? null : Math.max(n - planned, 0)
}

/**
 * What's left to save for a goal and, with a deadline, whether the plan's
 * own monthly payment is enough to make it: the leftover is for what isn't.
 */
function needLine(g: GoalSummary, planned: number): string {
  const togo = g.remaining > 0 ? `${formatMoneyCompact(Math.round(g.remaining))} to go` : ''
  const inPlan = planned > 0 ? `the plan puts ${formatMoneyCompact(planned)} a month aside` : ''
  switch (g.status.kind) {
    case 'reached':
      return 'Reached'
    case 'open':
      return ['No target: an open-ended fund', inPlan].filter(Boolean).join(' · ')
    case 'on-track':
    case 'behind': {
      const n = need(g)!
      const by = monthYear(g.goal.target_date!)
      if (planned >= n) return `${togo} · ${inPlan}, enough to make it by ${by} ✓`
      return `${togo} · needs ${formatMoneyCompact(n)}/mo by ${by}; ${
        planned > 0 ? `the plan puts ${formatMoneyCompact(planned)}, ` : 'none in the plan, '
      }${formatMoneyCompact(n - planned)} short`
    }
    case 'overdue':
      return `${togo} · the date has passed`
    case 'no-date':
      return [togo, inPlan, 'no date: add one in Edit to see what it needs'].filter(Boolean).join(' · ')
  }
}

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
  keep,
  onKeepChange,
  planned,
  overview,
}: {
  prevMonth: MonthKey
  /** Null when the month has no income logged. */
  leftover: number | null
  final: boolean
  value: PlanCarryover[]
  onChange: (next: PlanCarryover[]) => void
  /** What stays on the account before the goals get theirs. */
  keep: number
  onKeepChange: (keep: number) => void
  /** Goal id → what the planned month's own savings put toward it. */
  planned: Record<string, number>
  overview: SavingsOverview
}) {
  const chosen = new Map(value.map((c) => [c.goal_id, c]))
  const goals = overview.goals.filter((g) => !g.goal.archived || chosen.has(g.goal.id))
  if (!overview.available) return null

  const accounts = overview.accounts.map((a) => a.account)
  const name = formatMonthName(prevMonth)
  const amount = leftover !== null && leftover > 0 ? leftover : 0
  const parts = splitLeftover(amount, value, keep)
  const partOf = new Map(value.map((c, i) => [c.goal_id, parts[i]]))
  const total = value.filter(isShare).reduce((s, c) => s + c.share, 0)
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
    // a new goal joins an even split of what the set amounts leave
    onChange(
      evenShares(
        [...value, { goal_id: goalId, account_id: defaultGoalAccount(g, accounts), share: 0 }],
        true,
      ),
    )
  }
  const update = (goalId: string, patch: Partial<PlanCarryover>) =>
    onChange(value.map((c) => (c.goal_id === goalId ? { ...c, ...patch } : c)))
  // switching between % and zł re-spreads the percentages over the goals still taking one
  const setMode = (goalId: string, mode: 'share' | 'fixed', fixed = 0) =>
    onChange(
      evenShares(
        value.map((c) =>
          c.goal_id === goalId ? { ...c, fixed: mode === 'fixed' ? fixed : null } : c,
        ),
        true,
      ),
    )
  const shared = value.filter(isShare)
  const fixedTotal = value.reduce((s, c) => s + (isShare(c) ? 0 : (c.fixed ?? 0)), 0)
  const assigned = parts.reduce((s, x) => s + x, 0)

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
        Income, minus what was saved, minus spending. {status} Pick one goal or several, and
        give each a percentage or a set amount in złoty.
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
                className={`rounded-xl px-3 py-2 ring-1 ${
                  c ? 'bg-white/10 ring-white/30' : 'ring-white/10'
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!c}
                  onClick={() => toggle(g.goal.id)}
                  className="flex w-full min-w-0 items-center gap-2.5 text-left"
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
                    <span className="block text-xs leading-snug text-muted">{needLine(g, planned[g.goal.id] ?? 0)}</span>
                  </span>
                </button>
                {c && (
                  // under the name: % or zł, the value, and what it comes to
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[50px]">
                    <div
                      role="group"
                      aria-label={`${g.goal.name}: percentage or set amount`}
                      className="flex rounded-lg bg-white/5 p-0.5 text-xs ring-1 ring-white/10"
                    >
                      {(['share', 'fixed'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={(mode === 'share') === isShare(c)}
                          onClick={() =>
                            (mode === 'share') !== isShare(c) &&
                            setMode(g.goal.id, mode, partOf.get(g.goal.id) ?? 0)
                          }
                          className={`rounded-md px-2 py-0.5 font-semibold ${
                            (mode === 'share') === isShare(c)
                              ? 'bg-slate-50 text-ink'
                              : 'text-muted'
                          }`}
                        >
                          {mode === 'share' ? '%' : 'zł'}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-baseline gap-1 rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10 focus-within:ring-white/40">
                      <span className="sr-only">
                        {g.goal.name}: {isShare(c) ? 'share in percent' : 'amount in złoty'}
                      </span>
                      <input
                        value={isShare(c) ? c.share : (c.fixed ?? 0)}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/\D/g, '')) || 0
                          update(
                            g.goal.id,
                            isShare(c) ? { share: Math.min(n, 100) } : { fixed: n },
                          )
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        inputMode="numeric"
                        className={`bg-transparent text-right text-[15px] font-semibold tabular-nums text-white outline-none ${
                          isShare(c) ? 'w-9' : 'w-16'
                        }`}
                      />
                      <span className="text-xs text-muted">{isShare(c) ? '%' : 'zł'}</span>
                    </label>
                    {(gap(g, planned[g.goal.id] ?? 0) ?? 0) > 0 &&
                      c.fixed !== gap(g, planned[g.goal.id] ?? 0) && (
                        <button
                          type="button"
                          onClick={() =>
                            setMode(g.goal.id, 'fixed', gap(g, planned[g.goal.id] ?? 0)!)
                          }
                          className="rounded-full px-2 py-0.5 text-xs tabular-nums text-muted ring-1 ring-white/10 hover:text-white"
                        >
                          use the {formatMoneyCompact(gap(g, planned[g.goal.id] ?? 0)!)} short
                        </button>
                      )}
                    {amount > 0 && (
                      <span className="ml-auto text-xs font-semibold tabular-nums text-slate-200">
                        = {formatMoneyCompact(partOf.get(g.goal.id) ?? 0)}
                      </span>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {value.length > 0 && (
        <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">Keep on the account</p>
            <p className="text-xs leading-snug text-muted">
              A cushion for the start of the month; the goals share what’s above it
              {amount > 0 ? `: ${formatMoneyCompact(Math.max(Math.floor(amount - keep), 0))}` : ''}.
            </p>
          </div>
          <div className="w-32 shrink-0">
            <MoneyInput label="Keep on the account" value={keep} onChange={onKeepChange} />
          </div>
        </div>
      )}
      {amount > 0 && fixedTotal > amount - keep && (
        <p className="mt-2 text-xs text-amber-200">
          The set amounts come to {formatMoneyCompact(fixedTotal)}, more than the{' '}
          {formatMoneyCompact(Math.max(Math.floor(amount - keep), 0))} to share; they’re filled in
          order until it runs out.
        </p>
      )}
      {amount > 0 && value.length > 0 && shared.length === 0 && assigned < Math.floor(amount - keep) && (
        <p className="mt-2 text-xs text-slate-300">
          {formatMoneyCompact(Math.floor(amount - keep) - assigned)} more stays on the account; give
          one goal a percentage to take the rest.
        </p>
      )}
      {shared.length > 1 && total !== 100 && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-amber-200">The percentages add up to {total}%, not 100%.</span>
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
