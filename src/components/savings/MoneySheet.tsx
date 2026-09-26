import { useState, type FormEvent } from 'react'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useSavingsActions } from '../../hooks/useSavings'
import { formatMoneyCompact, roundMoney, todayKey } from '../../lib/calculations'
import type { AccountSummary, GoalSummary } from '../../lib/savings'
import type { Person } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { DatePicker } from '../DatePicker'
import { BottomSheet } from '../history/BottomSheet'
import { UserSwitcher } from '../UserSwitcher'
import { Field, Segments, Select, SubmitRow, inputClass } from './fields'

export type MoneyMode = 'deposit' | 'withdraw' | 'interest' | 'balance' | 'allocate' | 'transfer'

const TITLES: Record<MoneyMode, string> = {
  deposit: 'Save money',
  withdraw: 'Take money out',
  interest: 'Add interest',
  balance: 'Update the balance',
  allocate: 'Assign to a goal',
  transfer: 'Move between accounts',
}

const UNASSIGNED = ''

interface Props {
  mode: MoneyMode
  accounts: AccountSummary[]
  goals: GoalSummary[]
  /** Preselected, when opened from an account or a goal. */
  accountId?: string
  goalId?: string
  onClose: () => void
}

/**
 * One sheet for every way money moves. Each mode asks only for what it needs;
 * the database checks the rest (not more out than there is, goals never
 * holding more than the balance) and its explanation is shown as is.
 */
export function MoneySheet({ mode, accounts, goals, accountId, goalId, onClose }: Props) {
  const actions = useSavingsActions()
  const { person: devicePerson } = useDeviceUser()
  const open = accounts.filter((a) => !a.account.archived)
  const openGoals = goals.filter((g) => !g.goal.archived)
  // a goal on its own page: default to the account holding most of it
  const fundingAccount = goalId
    ? goals.find((g) => g.goal.id === goalId)?.funding[0]?.account.id
    : undefined

  const [account, setAccount] = useState(accountId ?? fundingAccount ?? open[0]?.account.id ?? '')
  const [target, setTarget] = useState(open.find((a) => a.account.id !== account)?.account.id ?? '')
  const [goal, setGoal] = useState(goalId ?? UNASSIGNED)
  const [amount, setAmount] = useState(0)
  const [direction, setDirection] = useState<'assign' | 'release'>('assign')
  const [date, setDate] = useState(todayKey())
  const [person, setPerson] = useState<Person>(devicePerson ?? 'bubs')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const summary = open.find((a) => a.account.id === account)
  const share = (id: string) => summary?.byGoal[id] ?? 0
  const goalName = (id: string) => goals.find((g) => g.goal.id === id)?.goal.name ?? 'Goal'

  // where money can come from on this account: unassigned, or a goal's share
  const available = goal === UNASSIGNED ? Math.max(summary?.unassigned ?? 0, 0) : share(goal)
  const common = { date, person, note }

  const pending = Object.values(actions).some((m) => m.isPending)
  const run = (promise: Promise<unknown>) =>
    promise.then(onClose).catch((e: Error) => setError(e.message))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const g = goal === UNASSIGNED ? null : goal
    if (mode === 'deposit')
      run(actions.saveTo.mutateAsync({ account, amount, goal: g, kind: 'deposit', ...common }))
    else if (mode === 'interest')
      run(actions.saveTo.mutateAsync({ account, amount, kind: 'interest', ...common }))
    else if (mode === 'withdraw')
      run(actions.takeFrom.mutateAsync({ account, amount, goal: g, ...common }))
    else if (mode === 'balance')
      run(actions.setBalance.mutateAsync({ account, balance: amount, ...common }))
    else if (mode === 'allocate' && g)
      run(
        actions.allocate.mutateAsync({
          account,
          goal: g,
          delta: direction === 'assign' ? amount : -amount,
        }),
      )
    else if (mode === 'transfer')
      run(actions.transfer.mutateAsync({ from: account, to: target, amount, goal: g, ...common }))
  }

  if (open.length === 0) {
    return (
      <BottomSheet title={TITLES[mode]} onClose={onClose}>
        <p className="pb-4 text-sm text-muted">
          Add an account first: money needs somewhere to be.
        </p>
      </BottomSheet>
    )
  }

  const accountSelect = (
    label: string,
    value: string,
    set: (v: string) => void,
    exclude?: string,
  ) => (
    <Field label={label}>
      <Select value={value} onChange={set}>
        {open
          .filter((a) => a.account.id !== exclude)
          .map((a) => (
            <option key={a.account.id} value={a.account.id}>
              {a.account.name} · {formatMoneyCompact(a.balance)}
            </option>
          ))}
      </Select>
    </Field>
  )

  const invalid =
    !account ||
    (mode === 'balance' ? amount < 0 : amount <= 0) ||
    (mode === 'transfer' && (!target || target === account)) ||
    (mode === 'allocate' && goal === UNASSIGNED)

  return (
    <BottomSheet title={TITLES[mode]} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        {accountSelect(mode === 'transfer' ? 'From' : 'Account', account, setAccount)}
        {mode === 'transfer' && accountSelect('To', target, setTarget, account)}

        {mode === 'allocate' && (
          <Segments
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'assign', label: 'Assign' },
              { value: 'release', label: 'Give back' },
            ]}
          />
        )}

        {(mode === 'deposit' ||
          mode === 'withdraw' ||
          mode === 'transfer' ||
          mode === 'allocate') && (
          <Field
            label={mode === 'deposit' ? 'For' : mode === 'allocate' ? 'Goal' : 'Take from'}
            help={
              mode === 'deposit'
                ? undefined
                : mode === 'allocate'
                  ? direction === 'assign'
                    ? `${formatMoneyCompact(Math.max(summary?.unassigned ?? 0, 0))} unassigned on this account`
                    : `${formatMoneyCompact(share(goal))} of it on this account`
                  : `${formatMoneyCompact(available)} available`
            }
          >
            <Select value={goal} onChange={setGoal}>
              {mode !== 'allocate' && (
                <option value={UNASSIGNED}>
                  {mode === 'deposit' ? 'No goal (unassigned)' : 'Unassigned money'}
                </option>
              )}
              {mode === 'allocate' && goal === UNASSIGNED && <option value="">Pick a goal</option>}
              {openGoals
                .filter((g) => mode === 'deposit' || mode === 'allocate' || share(g.goal.id) > 0)
                .map((g) => (
                  <option key={g.goal.id} value={g.goal.id}>
                    {g.goal.name}
                    {mode !== 'deposit' && share(g.goal.id) > 0
                      ? ` · ${formatMoneyCompact(share(g.goal.id))} here`
                      : ''}
                  </option>
                ))}
            </Select>
          </Field>
        )}

        <Field
          label={mode === 'balance' ? 'Balance the bank shows' : 'Amount'}
          help={
            mode === 'balance' && summary
              ? `The app has ${formatMoneyCompact(summary.balance)}; the difference is booked as a correction.${
                  summary.allocated > 0
                    ? ` Goals hold ${formatMoneyCompact(summary.allocated)} of it.`
                    : ''
                }`
              : undefined
          }
        >
          <MoneyInput
            value={amount}
            onChange={(v) => setAmount(roundMoney(v))}
            label="Amount"
            size="lg"
          />
        </Field>

        {mode !== 'allocate' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DatePicker value={date} onChange={setDate} />
            {mode !== 'interest' && mode !== 'balance' && (
              <UserSwitcher value={person} onChange={setPerson} />
            )}
          </div>
        )}

        {mode !== 'allocate' && (
          <Field label="Note (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder={mode === 'deposit' ? 'e.g. September savings' : undefined}
              className={inputClass}
            />
          </Field>
        )}

        <SubmitRow
          label={
            mode === 'allocate'
              ? direction === 'assign'
                ? `Assign to ${goal ? goalName(goal) : 'goal'}`
                : 'Give back'
              : TITLES[mode]
          }
          disabled={invalid}
          pending={pending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
