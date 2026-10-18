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
import { personIds } from '../../lib/people'
import { t } from '../../i18n'

export type MoneyMode = 'deposit' | 'withdraw' | 'interest' | 'balance' | 'allocate' | 'transfer'

const title = (mode: MoneyMode) => t(`money.title.${mode}`)

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
  const [person, setPerson] = useState<Person>(devicePerson ?? personIds()[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const summary = open.find((a) => a.account.id === account)
  const share = (id: string) => summary?.byGoal[id] ?? 0
  const goalName = (id: string) =>
    goals.find((g) => g.goal.id === id)?.goal.name ?? t('split.goal')

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
      <BottomSheet title={title(mode)} onClose={onClose}>
        <p className="pb-4 text-sm text-muted">
          {t('money.noAccount')}
        </p>
      </BottomSheet>
    )
  }

  const accountSelect = (
    label: string,
    value: string,
    set: (v: string) => void,
    exclude?: string,
    help?: string,
  ) => (
    <Field label={label} help={help}>
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
    <BottomSheet title={title(mode)} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        {/* saving and taking out move money between the savings and the
            everyday money (what's left to spend), so say which way */}
        {accountSelect(
          mode === 'transfer'
            ? t('money.from')
            : mode === 'deposit'
              ? t('money.depositTo')
              : mode === 'withdraw'
                ? t('money.withdrawFrom')
                : t('money.account'),
          account,
          setAccount,
          undefined,
          mode === 'deposit'
            ? t('money.depositToHelp')
            : mode === 'withdraw'
              ? t('money.withdrawFromHelp')
              : undefined,
        )}
        {mode === 'transfer' && accountSelect(t('money.to'), target, setTarget, account)}

        {mode === 'allocate' && (
          <Segments
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'assign', label: t('money.assign') },
              { value: 'release', label: t('money.giveBack') },
            ]}
          />
        )}

        {(mode === 'deposit' ||
          mode === 'withdraw' ||
          mode === 'transfer' ||
          mode === 'allocate') && (
          <Field
            label={
              mode === 'deposit'
                ? t('money.for')
                : mode === 'allocate'
                  ? t('split.goal')
                  : t('money.takeFrom')
            }
            help={
              mode === 'deposit'
                ? undefined
                : mode === 'allocate'
                  ? direction === 'assign'
                    ? t('money.unassignedHere', {
                        amount: formatMoneyCompact(Math.max(summary?.unassigned ?? 0, 0)),
                      })
                    : t('money.shareHere', { amount: formatMoneyCompact(share(goal)) })
                  : t('money.available', { amount: formatMoneyCompact(available) })
            }
          >
            <Select value={goal} onChange={setGoal}>
              {mode !== 'allocate' && (
                <option value={UNASSIGNED}>
                  {mode === 'deposit' ? t('money.noGoal') : t('borrow.unassigned')}
                </option>
              )}
              {mode === 'allocate' && goal === UNASSIGNED && (
                <option value="">{t('money.pickGoal')}</option>
              )}
              {openGoals
                .filter((g) => mode === 'deposit' || mode === 'allocate' || share(g.goal.id) > 0)
                .map((g) => (
                  <option key={g.goal.id} value={g.goal.id}>
                    {g.goal.name}
                    {mode !== 'deposit' && share(g.goal.id) > 0
                      ? ` · ${t('money.here', { amount: formatMoneyCompact(share(g.goal.id)) })}`
                      : ''}
                  </option>
                ))}
            </Select>
          </Field>
        )}

        <Field
          label={mode === 'balance' ? t('money.bankBalance') : t('entry.amount')}
          help={
            mode === 'balance' && summary
              ? t(summary.allocated > 0 ? 'money.balanceHelpGoals' : 'money.balanceHelp', {
                  amount: formatMoneyCompact(summary.balance),
                  goals: formatMoneyCompact(summary.allocated),
                })
              : undefined
          }
        >
          <MoneyInput
            value={amount}
            onChange={(v) => setAmount(roundMoney(v))}
            label={t('entry.amount')}
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
          <Field label={t('goalSheet.note')}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder={mode === 'deposit' ? t('money.notePlaceholder') : undefined}
              className={inputClass}
            />
          </Field>
        )}

        <SubmitRow
          label={
            mode === 'allocate'
              ? direction === 'assign'
                ? t('money.assignTo', { name: goal ? goalName(goal) : t('split.goal') })
                : t('money.giveBack')
              : title(mode)
          }
          disabled={invalid}
          pending={pending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
