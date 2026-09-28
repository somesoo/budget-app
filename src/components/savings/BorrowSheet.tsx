import { useState, type FormEvent } from 'react'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useSavingsActions, type SavingsOverview } from '../../hooks/useSavings'
import { formatMoneyCompact } from '../../lib/calculations'
import { borrowSources, instalment } from '../../lib/loans'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, SubmitRow, inputClass } from './fields'

const REPAY_MONTHS = [1, 3, 6, 12]

/**
 * "I need money": borrow from savings for something that can't wait. Suggests
 * where to take it from (money no goal is waiting for first, then goals
 * without a deadline, then the furthest deadline), says what it does to that
 * goal, and sets the instalment the coming plans pay back.
 */
export function BorrowSheet({
  overview,
  onClose,
}: {
  overview: SavingsOverview
  onClose: () => void
}) {
  const { borrow } = useSavingsActions()
  const { person } = useDeviceUser()
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [months, setMonths] = useState(3)
  const [picked, setPicked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sources = borrowSources(overview.accounts, overview.goals, Math.max(amount, 1))
  const keyOf = (s: (typeof sources)[number]) => `${s.account.id}:${s.goal?.goal.id ?? ''}`
  const covering = sources.filter((s) => s.available >= amount)
  // the suggestion is the first source that covers it, until one is picked
  const chosen = sources.find((s) => keyOf(s) === picked) ?? covering[0] ?? null
  const monthly = amount > 0 ? instalment(amount, months) : 0
  const total = sources.reduce((s, x) => s + x.available, 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!chosen) return
    setError(null)
    try {
      await borrow.mutateAsync({
        account: chosen.account.id,
        goal: chosen.goal?.goal.id ?? null,
        amount,
        monthly,
        note: note.trim(),
        person,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!overview.loansAvailable) {
    return (
      <BottomSheet title="I need money" onClose={onClose}>
        <p className="pb-4 text-sm leading-relaxed text-slate-300">
          Borrowing from savings needs{' '}
          <code className="rounded bg-white/10 px-1">supabase/migrations/0011_savings_loans.sql</code>.
          Run it in the SQL Editor, as with the earlier ones.
        </p>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="I need money" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <p className="text-sm leading-snug text-slate-300">
          Borrow it from your savings and pay it back in instalments: the coming months’ plans
          put each one aside first, until the goal is whole again.
        </p>

        <Field label="How much">
          <MoneyInput value={amount} onChange={setAmount} label="Amount" size="lg" />
        </Field>
        <Field label="What for">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="e.g. car repair"
            className={inputClass}
          />
        </Field>

        {amount > 0 && (
          <section>
            <p className="mb-1.5 text-sm text-muted">Take it from</p>
            {covering.length === 0 ? (
              <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                No single place has {formatMoneyCompact(amount)}
                {total > 0 ? ` (there’s ${formatMoneyCompact(total)} saved in all)` : ''}. Borrow
                less, or twice from two places.
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {covering.map((s, i) => {
                  const selected = chosen !== null && keyOf(s) === keyOf(chosen)
                  return (
                    <li key={keyOf(s)}>
                      <button
                        type="button"
                        onClick={() => setPicked(keyOf(s))}
                        aria-pressed={selected}
                        className={`w-full rounded-xl px-3 py-2.5 text-left ring-1 transition ${
                          selected
                            ? 'bg-white/10 ring-white/40'
                            : 'ring-white/10 hover:bg-white/5'
                        }`}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[15px] text-white">
                            {s.goal ? s.goal.goal.name : 'Unassigned money'}
                            {i === 0 && (
                              <span className="ml-1.5 text-xs font-semibold text-accent-soft">
                                suggested
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-slate-300">
                            {formatMoneyCompact(s.available)}
                          </span>
                        </span>
                        <span className="block text-xs text-muted">
                          on {s.account.name} · {s.reason}
                          {s.neededAfter !== null &&
                            ` · until paid back it needs ${formatMoneyCompact(Math.round(s.neededAfter))}/mo to stay on time`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {amount > 0 && chosen && (
          <>
            <Field label="Pay it back over">
              <div className="flex flex-wrap gap-1.5">
                {REPAY_MONTHS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonths(m)}
                    aria-pressed={months === m}
                    className={`rounded-full px-3 py-1.5 text-sm ring-1 ${
                      months === m
                        ? 'bg-white/15 text-white ring-white/40'
                        : 'text-slate-300 ring-white/10'
                    }`}
                  >
                    {m} {m === 1 ? 'month' : 'months'}
                  </button>
                ))}
              </div>
            </Field>
            <p className="rounded-xl bg-accent/10 px-3 py-2.5 text-sm leading-snug text-slate-200 ring-1 ring-accent/25">
              <span className="font-semibold text-white">In the bank:</span> transfer{' '}
              {formatMoneyCompact(amount)} from {chosen.account.name} to your everyday account.
              From next month’s plan, {formatMoneyCompact(monthly)} a month goes back
              {chosen.goal ? ` to ${chosen.goal.goal.name}` : ''}.
            </p>
          </>
        )}

        <SubmitRow
          label={amount > 0 ? `Borrow ${formatMoneyCompact(amount)}` : 'Borrow'}
          disabled={amount <= 0 || !chosen || !note.trim()}
          pending={borrow.isPending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
