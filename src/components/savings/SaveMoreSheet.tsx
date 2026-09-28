import { useState, type FormEvent } from 'react'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useMonthMoney } from '../../hooks/useMonthMoney'
import { useSavingsActions, type SavingsOverview } from '../../hooks/useSavings'
import { defaultGoalAccount } from '../../lib/allocations'
import { currentMonthKey, formatMoneyCompact, roundMoney } from '../../lib/calculations'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, Select, SubmitRow } from './fields'

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
        note: 'Extra savings',
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (open.length === 0) {
    return (
      <BottomSheet title="Save more" onClose={onClose}>
        <p className="pb-4 text-sm text-muted">Add a savings account first.</p>
      </BottomSheet>
    )
  }

  const chips = [
    { value: roundDown(free / 4), label: 'a quarter' },
    { value: roundDown(free / 2), label: 'half' },
    { value: roundDown(free), label: 'all of it' },
  ].filter((c, i, all) => c.value > 0 && all.findIndex((x) => x.value === c.value) === i)
  const need = (id: string) => {
    const g = goals.find((x) => x.goal.id === id)
    return g && (g.status.kind === 'behind' || g.status.kind === 'on-track')
      ? ` · needs ${formatMoneyCompact(Math.round(g.status.neededPerMonth))}/mo`
      : ''
  }

  return (
    <BottomSheet title="Save more" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-sm text-muted">Safe to spend this month</p>
          <p
            className={`text-2xl font-bold tabular-nums ${free < 0 ? 'text-red-300' : 'text-white'}`}
          >
            {free < 0 ? '−' : ''}
            {formatMoneyCompact(Math.abs(Math.round(free)))}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-300">
            {money.safe === null
              ? 'No income logged or planned this month, so there’s nothing to go on: save what you know you can.'
              : free <= 0
                ? 'Nothing is free this month. Saving more now would come out of money that’s already needed.'
                : 'What’s left of this month’s income after the planned savings and what’s been spent. Keep some for the rest of the month.'}
          </p>
        </div>

        <Field label="How much">
          <MoneyInput value={amount} onChange={setAmount} label="Amount" size="lg" />
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

        <Field label="For">
          <Select value={goalId} onChange={pickGoal}>
            {goals.map((g) => (
              <option key={g.goal.id} value={g.goal.id}>
                {g.goal.name}
                {need(g.goal.id)}
              </option>
            ))}
            <option value={NO_GOAL}>No goal (unassigned)</option>
          </Select>
        </Field>
        <Field label="Onto">
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
            <span className="font-semibold text-white">In the bank:</span> transfer{' '}
            {formatMoneyCompact(amount)} from your everyday account to {account.name}
            {goal ? ` (title: ${goal.goal.name})` : ''}. Then save it here.
            {free > 0 && amount > free && (
              <span className="mt-1 block text-amber-200">
                That’s {formatMoneyCompact(roundMoney(amount - free))} more than is free this month.
              </span>
            )}
          </p>
        )}

        <SubmitRow
          label={`Save ${formatMoneyCompact(amount)}`}
          disabled={amount <= 0 || !accountId}
          pending={saveTo.isPending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
