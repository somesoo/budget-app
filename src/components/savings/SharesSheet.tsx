import { useState, type FormEvent } from 'react'
import { useSavingsActions } from '../../hooks/useSavings'
import { formatMoneyCompact, roundMoney } from '../../lib/calculations'
import { shareChanges } from '../../lib/loans'
import type { AccountSummary, GoalSummary } from '../../lib/savings'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { SubmitRow } from './fields'
import { t } from '../../i18n'

/**
 * Correcting which goal holds how much of an account, when an assignment went
 * wrong. Only the shares change: the balance stays, and whatever no goal holds
 * is unassigned. Setting a goal to 0 takes its share away.
 */
export function SharesSheet({
  summary,
  goals,
  onClose,
}: {
  summary: AccountSummary
  goals: GoalSummary[]
  onClose: () => void
}) {
  const { allocate } = useSavingsActions()
  // goals holding something here, then every other open goal
  const listed = goals.filter((g) => (summary.byGoal[g.goal.id] ?? 0) > 0 || !g.goal.archived)
  const [shares, setShares] = useState<Record<string, number>>(() =>
    Object.fromEntries(listed.map((g) => [g.goal.id, summary.byGoal[g.goal.id] ?? 0])),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const setAside = roundMoney(Object.values(shares).reduce((s, v) => s + v, 0))
  const unassigned = roundMoney(summary.balance - setAside)
  const over = unassigned < 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      // decreases first, so the increases have unassigned money to draw on
      for (const c of shareChanges(summary, shares)) {
        await allocate.mutateAsync({ account: summary.account.id, goal: c.goalId, delta: c.delta })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <BottomSheet title={t('shares.title', { name: summary.account.name })} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <p className="text-sm leading-snug text-slate-300">
          {t('shares.intro', { amount: formatMoneyCompact(summary.balance) })}
        </p>

        <ul className="grid gap-2">
          {listed.map((g) => (
            <li key={g.goal.id} className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: g.goal.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] text-white">{g.goal.name}</span>
              {(shares[g.goal.id] ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setShares({ ...shares, [g.goal.id]: 0 })}
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs text-muted ring-1 ring-white/10 hover:text-white"
                >
                  {t('entry.clear')}
                </button>
              )}
              <div className="w-32 shrink-0">
                <MoneyInput
                  label={t('shares.shareOf', { name: g.goal.name })}
                  value={shares[g.goal.id] ?? 0}
                  onChange={(v) => setShares({ ...shares, [g.goal.id]: v })}
                />
              </div>
            </li>
          ))}
        </ul>

        <div
          className={`flex items-baseline justify-between rounded-xl px-3 py-2.5 text-sm ${
            over ? 'bg-red-500/15 text-red-300' : 'bg-white/5 text-slate-300'
          }`}
        >
          <span>{over ? t('shares.over') : t('shares.unassigned')}</span>
          <span className="font-semibold tabular-nums">
            {formatMoneyCompact(Math.abs(unassigned))}
          </span>
        </div>

        <SubmitRow
          label={t('shares.save')}
          disabled={over}
          pending={pending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
