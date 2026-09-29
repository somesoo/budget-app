import { useState, type FormEvent } from 'react'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useMonthMoney } from '../../hooks/useMonthMoney'
import { useSavingsActions, type SavingsOverview } from '../../hooks/useSavings'
import { defaultGoalAccount } from '../../lib/allocations'
import { currentMonthKey, formatMoneyCompact, roundMoney } from '../../lib/calculations'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, Select, SubmitRow } from './fields'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'

const NO_GOAL = ''

/** Rounds down to 10 zł: a suggestion shouldn't leave the month a few złoty short. */
const roundDown = (x: number) => Math.max(Math.floor(x / 10) * 10, 0)

/**
 * "Save more": how much of this month is still free, a suggestion of how much
 * of it to put aside, and the goal that needs it most. Books the deposit and
 * says which transfer to make in the bank.
 */
export function SaveMoreSheet({
  overview,
  onClose,
}: {
  overview: SavingsOverview
  onClose: () => void
}) {
  const { saveTo } = useSavingsActions()
  const { person } = useDeviceUser()
  const money = useMonthMoney(currentMonthKey())
  const free = money.safe?.amount ?? 0

  const accounts = overview.accounts.map((a) => a.account)
  const open = accounts.filter((a) => !a.archived)
  // the goals that need it most first: behind, then on track, then the rest
  const order = { behind: 0, 'on-track': 1, overdue: 2, 'no-date': 3, open: 4, reached: 5 }
  const goals = overview.goals
    .filter((g) => !g.goal.archived && g.status.kind !== 'reached')
    .sort((a, b) => order[a.status.kind] - order[b.status.kind])

  const [amount, setAmount] = useState(roundDown(free / 2))
  const [goalId, setGoalId] = useState(goals[0]?.goal.id ?? NO_GOAL)
  const goal = goals.find((g) => g.goal.id === goalId)
  const [accountId, setAccountId] = useState(
    (goal && defaultGoalAccount(goal, accounts)) ?? open[0]?.id ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const account = open.find((a) => a.id === accountId)

  const pickGoal = (id: string) => {
    setGoalId(id)
    const g = goals.find((x) => x.goal.id === id)
    const acc = g && defaultGoalAccount(g, accounts)
    if (acc) setAccountId(acc)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await saveTo.mutateAsync({
        account: accountId,
        amount,
        goal: goalId || null,
        person,
        note: t('saveMore.note'),
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (open.length === 0) {
    return (
      <BottomSheet title={t('saveMore.title')} onClose={onClose}>
        <p className="pb-4 text-sm text-muted">{t('saveMore.noAccount')}</p>
      </BottomSheet>
    )
  }

  const chips = [
    { value: roundDown(free / 4), label: t('saveMore.quarter') },
    { value: roundDown(free / 2), label: t('saveMore.half') },
    { value: roundDown(free), label: t('saveMore.all') },
  ].filter((c, i, all) => c.value > 0 && all.findIndex((x) => x.value === c.value) === i)
  const need = (id: string) => {
    const g = goals.find((x) => x.goal.id === id)
    return g && (g.status.kind === 'behind' || g.status.kind === 'on-track')
      ? ` · ${t('saveMore.needs', { amount: formatMoneyCompact(Math.round(g.status.neededPerMonth)) })}`
      : ''
  }

  return (
    <BottomSheet title={t('saveMore.title')} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-sm text-muted">{t('saveMore.safe')}</p>
          <p
            className={`text-2xl font-bold tabular-nums ${free < 0 ? 'text-red-300' : 'text-white'}`}
          >
            {free < 0 ? '−' : ''}
            {formatMoneyCompact(Math.abs(Math.round(free)))}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-300">
            {money.safe === null
              ? t('saveMore.noIncome')
              : free <= 0
                ? t('saveMore.nothingFree')
                : t('saveMore.safeHelp')}
          </p>
        </div>

        <Field label={t('borrow.howMuch')}>
          <MoneyInput value={amount} onChange={setAmount} label={t('entry.amount')} size="lg" />
        </Field>
        {chips.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setAmount(c.value)}
                aria-pressed={amount === c.value}
                className={`rounded-full px-3 py-1 text-sm tabular-nums ring-1 ${
                  amount === c.value
                    ? 'bg-white/15 text-white ring-white/40'
                    : 'text-slate-300 ring-white/10'
                }`}
              >
                {formatMoneyCompact(c.value)}
                <span className="ml-1 text-xs text-muted">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        <Field label={t('money.for')}>
          <Select value={goalId} onChange={pickGoal}>
            {goals.map((g) => (
              <option key={g.goal.id} value={g.goal.id}>
                {g.goal.name}
                {need(g.goal.id)}
              </option>
            ))}
            <option value={NO_GOAL}>{t('money.noGoal')}</option>
          </Select>
        </Field>
        <Field label={t('saveMore.onto')}>
          <Select value={accountId} onChange={setAccountId}>
            {open.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        {amount > 0 && account && (
          <p className="rounded-xl bg-accent/10 px-3 py-2.5 text-sm leading-snug text-slate-200 ring-1 ring-accent/25">
            <Trans
              k={goal ? 'saveMore.bankGoal' : 'saveMore.bank'}
              values={{
                amount: formatMoneyCompact(amount),
                account: account.name,
                goal: goal?.goal.name ?? '',
              }}
              tags={{ b: (s) => <span className="font-semibold text-white">{s}</span> }}
            />
            {free > 0 && amount > free && (
              <span className="mt-1 block text-amber-200">
                {t('saveMore.moreThanFree', { amount: formatMoneyCompact(roundMoney(amount - free)) })}
              </span>
            )}
          </p>
        )}

        <SubmitRow
          label={t('saveMore.submit', { amount: formatMoneyCompact(amount) })}
          disabled={amount <= 0 || !accountId}
          pending={saveTo.isPending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
