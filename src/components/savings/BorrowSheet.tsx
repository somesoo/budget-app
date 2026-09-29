import { useState, type FormEvent } from 'react'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useSavingsActions, type SavingsOverview } from '../../hooks/useSavings'
import { formatMoneyCompact } from '../../lib/calculations'
import { borrowSources, instalment } from '../../lib/loans'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, SubmitRow, inputClass } from './fields'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'

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
      <BottomSheet title={t('borrow.title')} onClose={onClose}>
        <p className="pb-4 text-sm leading-relaxed text-slate-300">
          <Trans
            k="borrow.migration"
            values={{ file: 'supabase/archive/0011_savings_loans.sql' }}
            tags={{ code: (s) => <code className="rounded bg-white/10 px-1">{s}</code> }}
          />
        </p>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title={t('borrow.title')} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <p className="text-sm leading-snug text-slate-300">
          {t('borrow.intro')}
        </p>

        <Field label={t('borrow.howMuch')}>
          <MoneyInput value={amount} onChange={setAmount} label={t('entry.amount')} size="lg" />
        </Field>
        <Field label={t('borrow.whatFor')}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder={t('borrow.whatForPlaceholder')}
            className={inputClass}
          />
        </Field>

        {amount > 0 && (
          <section>
            <p className="mb-1.5 text-sm text-muted">{t('borrow.from')}</p>
            {covering.length === 0 ? (
              <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                {total > 0
                  ? t('borrow.noPlaceTotal', {
                      amount: formatMoneyCompact(amount),
                      total: formatMoneyCompact(total),
                    })
                  : t('borrow.noPlace', { amount: formatMoneyCompact(amount) })}
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
                            {s.goal ? s.goal.goal.name : t('borrow.unassigned')}
                            {i === 0 && (
                              <span className="ml-1.5 text-xs font-semibold text-accent-soft">
                                {t('borrow.suggested')}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-slate-300">
                            {formatMoneyCompact(s.available)}
                          </span>
                        </span>
                        <span className="block text-xs text-muted">
                          {t('borrow.on', { name: s.account.name })} · {s.reason}
                          {s.neededAfter !== null &&
                            ` · ${t('borrow.neededAfter', {
                              amount: formatMoneyCompact(Math.round(s.neededAfter)),
                            })}`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {amount > 0 && chosen?.goal?.goal.is_emergency && chosen.goal.saved > 0 && (
          <p
            className={`rounded-xl px-3 py-2.5 text-sm leading-snug ring-1 ${
              amount > chosen.goal.saved / 2
                ? 'bg-red-500/10 text-red-200 ring-red-400/30'
                : 'bg-amber-400/10 text-amber-100 ring-amber-300/25'
            }`}
          >
            {t('borrow.emergencyShare', {
              percent: Math.round((amount / chosen.goal.saved) * 100),
              name: chosen.goal.goal.name,
            })}{' '}
            {amount > chosen.goal.saved / 2 ? t('borrow.emergencyMost') : t('borrow.emergencySome')}
          </p>
        )}

        {amount > 0 && chosen && (
          <>
            <Field label={t('borrow.repayOver')}>
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
                    {t('borrow.months', { count: m })}
                  </button>
                ))}
              </div>
            </Field>
            <p className="rounded-xl bg-accent/10 px-3 py-2.5 text-sm leading-snug text-slate-200 ring-1 ring-accent/25">
              <Trans
                k={chosen.goal ? 'borrow.bankGoal' : 'borrow.bank'}
                values={{
                  amount: formatMoneyCompact(amount),
                  account: chosen.account.name,
                  monthly: formatMoneyCompact(monthly),
                  goal: chosen.goal?.goal.name ?? '',
                }}
                tags={{ b: (s) => <span className="font-semibold text-white">{s}</span> }}
              />
            </p>
          </>
        )}

        <SubmitRow
          label={
            amount > 0
              ? t('borrow.submitAmount', { amount: formatMoneyCompact(amount) })
              : t('borrow.submit')
          }
          disabled={amount <= 0 || !chosen || !note.trim()}
          pending={borrow.isPending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
