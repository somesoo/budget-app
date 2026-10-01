import { CaretRight, PiggyBank } from '@phosphor-icons/react'
import { useState } from 'react'
import { CURRENCY_SUFFIX } from '../../config'
import type { GoalTrip } from '../../hooks/useGoalTrips'
import { useSavingsOverview } from '../../hooks/useSavings'
import { formatAmount, withAlpha } from '../../lib/calculations'
import { BottomSheet } from '../history/BottomSheet'
import { t } from '../../i18n'

const GOALS_COLOR = '#22c55e'

/**
 * One tile for every savings goal, next to the monthly categories. What's
 * spent from a goal is paid from savings, so it isn't part of the month.
 */
export function GoalsTile({
  goals,
  height,
  onClick,
}: {
  goals: GoalTrip[]
  height: number
  onClick: () => void
}) {
  // no total here: spending from goals runs across months, and a sum among the
  // month's tiles would read as this month's spending
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full touch-manipulation flex-col justify-between overflow-hidden rounded-2xl p-2 text-left ring-1 ring-white/10 transition active:scale-[0.97]"
      style={{ height, backgroundColor: withAlpha(GOALS_COLOR, 0.18) }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate text-[12px] font-semibold leading-[15px] text-white">
          {t('add.goals')}
        </span>
        <PiggyBank weight="fill" aria-hidden className="shrink-0" style={{ color: GOALS_COLOR }} />
      </div>
      <div>
        <div className="truncate text-[15px] font-bold leading-5 text-white">
          {t('add.goalsTile.spend')}
        </div>
        <div className="truncate text-[10.5px] font-medium leading-[14px] text-white/90">
          {t('add.goalsTile.count', { count: goals.length })}
        </div>
      </div>
    </button>
  )
}

/** Which goal the expense is paid from. */
export function GoalPicker({
  goals,
  onPick,
  onClose,
}: {
  goals: GoalTrip[]
  /** Gets the goal's category, making it if it isn't there yet. */
  onPick: (goal: GoalTrip) => Promise<void> | void
  onClose: () => void
}) {
  const savings = useSavingsOverview()
  // what's still on the accounts for it; unknown before the savings migration
  const savedOf = (id: string) =>
    savings.available ? (savings.goals.find((s) => s.goal.id === id)?.saved ?? 0) : null
  const money = (amount: number) => `${formatAmount(Math.round(amount))} ${CURRENCY_SUFFIX}`
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = async (g: GoalTrip) => {
    setBusy(g.goal.id)
    setError(null)
    try {
      await onPick(g)
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  return (
    <BottomSheet title={t('add.goalPicker.title')} onClose={onClose}>
      <p className="-mt-2 mb-3 text-sm text-muted">
        {t('add.goalPicker.help')}
      </p>
      {goals.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {t('widgets.goals.empty')}
        </p>
      ) : (
        <ul className="grid gap-2 pb-2">
          {goals.map((g) => {
            const target = g.goal.target_amount
            const spent = g.trip?.spent ?? 0
            const saved = savedOf(g.goal.id)
            // spent from it · still saved for it · what it's for
            const figures = [
              t('add.goalPicker.figSpent', { amount: money(spent) }),
              saved !== null && t('add.goalPicker.figSaved', { amount: money(saved) }),
              target > 0 && t('add.goalPicker.figTarget', { amount: money(target) }),
            ].filter(Boolean)
            return (
              <li key={g.goal.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => pick(g)}
                  className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-left ring-1 ring-white/10 transition hover:bg-white/5 active:scale-[0.99] disabled:opacity-60"
                  style={{ backgroundColor: withAlpha(g.goal.color, 0.12) }}
                >
                  <span
                    aria-hidden
                    className="h-8 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: g.goal.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-white">
                      {g.goal.name}
                    </span>
                    <span className="block text-xs tabular-nums text-slate-300">
                      {figures.join(' · ')}
                    </span>
                  </span>
                  <CaretRight aria-hidden className="shrink-0 text-muted" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-300">Couldn’t open it: {error}</p>}
    </BottomSheet>
  )
}

