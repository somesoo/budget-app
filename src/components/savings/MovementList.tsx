import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { PERSON_LABELS } from '../../config'
import { useSavingsActions } from '../../hooks/useSavings'
import { formatDayShort, formatMoney, formatMonth, monthKeyOfDate } from '../../lib/calculations'
import type { Goal, SavingsAccount, SavingsMovement } from '../../types'

/** Months listed before "Show all". */
const MONTHS_SHOWN = 3

const KIND_LABEL: Record<SavingsMovement['kind'], string> = {
  deposit: 'Saved',
  withdrawal: 'Taken out',
  interest: 'Interest',
  adjustment: 'Balance corrected',
  transfer: 'Moved',
}

/**
 * Movements by month, newest first. Deleting asks once more: it can shrink
 * goal shares when the money it brought in is gone (the database decides how).
 */
export function MovementList({
  movements,
  accounts,
  goals,
  showAccount = false,
}: {
  movements: SavingsMovement[]
  accounts: SavingsAccount[]
  goals: Goal[]
  showAccount?: boolean
}) {
  const { deleteMovement } = useSavingsActions()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Account'
  const goalName = (id: string | null) => (id ? goals.find((g) => g.id === id)?.name : undefined)

  if (movements.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Nothing here yet.</p>
  }

  const groups: { month: string; items: SavingsMovement[] }[] = []
  for (const m of movements) {
    const key = monthKeyOfDate(m.movement_date)
    const last = groups[groups.length - 1]
    if (last?.month === key) last.items.push(m)
    else groups.push({ month: key, items: [m] })
  }

  const shown = showAll ? groups : groups.slice(0, MONTHS_SHOWN)

  return (
    <div className="space-y-4">
      {shown.map((g) => (
        <section key={g.month}>
          <h3 className="mb-1 px-1 text-sm font-semibold text-white">{formatMonth(g.month)}</h3>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/5">
            {g.items.map((m) => {
              const goal = goalName(m.goal_id)
              const detail = [
                showAccount ? accountName(m.account_id) : null,
                goal ? `for ${goal}` : null,
                m.person ? PERSON_LABELS[m.person] : null,
                formatDayShort(m.movement_date),
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-white">
                      {m.note ?? KIND_LABEL[m.kind]}
                    </p>
                    <p className="truncate text-[13px] text-muted">
                      {m.note ? `${KIND_LABEL[m.kind]} · ` : ''}
                      {detail}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[15px] font-semibold tabular-nums ${
                      m.amount > 0 ? 'text-positive' : 'text-white'
                    }`}
                  >
                    {m.amount > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(m.amount))}
                  </span>
                  {confirming === m.id ? (
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          deleteMovement.mutate(m.id, { onSettled: () => setConfirming(null) })
                        }
                        className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                      >
                        Delete{m.transfer_id ? ' both' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="rounded-full px-2 py-1 text-xs text-muted hover:text-white"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(m.id)}
                      aria-label={`Delete: ${m.note ?? KIND_LABEL[m.kind]}, ${formatMoney(Math.abs(m.amount))}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-white"
                    >
                      <Trash aria-hidden />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {groups.length > shown.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5"
        >
          Show all {groups.length} months
        </button>
      )}
    </div>
  )
}
