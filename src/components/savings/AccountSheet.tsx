import { useState, type FormEvent } from 'react'
import { PERSON_LABELS } from '../../config'
import {
  useDeleteAccount,
  useSaveAccount,
  useSavingsActions,
  useSavingsOverview,
} from '../../hooks/useSavings'
import { formatMoneyCompact } from '../../lib/calculations'
import type { AccountKind, SavingsAccount } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, Select, SubmitRow, inputClass } from './fields'
import { ColorChoice } from './ColorChoice'

export const ACCOUNT_KINDS: Record<AccountKind, string> = {
  savings: 'Savings account',
  deposit: 'Term deposit',
  investment: 'Investments',
  ike: 'IKE',
  ikze: 'IKZE',
  retirement: 'Other retirement',
  cash: 'Cash',
  other: 'Other',
}

export const ownerLabel = (owner: SavingsAccount['owner']) =>
  owner === 'joint' ? 'Joint' : PERSON_LABELS[owner]

/** New account, or editing one. A new one can start with the balance it has today. */
export function AccountSheet({
  account,
  onClose,
  onDeleted,
}: {
  account?: SavingsAccount
  onClose: () => void
  /** After the account is deleted: its page has nothing left to show. */
  onDeleted?: () => void
}) {
  const save = useSaveAccount()
  const remove = useDeleteAccount()
  const { setBalance } = useSavingsActions()
  const overview = useSavingsOverview()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'savings')
  const [owner, setOwner] = useState<SavingsAccount['owner']>(account?.owner ?? 'joint')
  const [rate, setRate] = useState(
    account?.interest_rate != null ? String(account.interest_rate) : '',
  )
  const [color, setColor] = useState(account?.color ?? '#3987e5')
  const [opening, setOpening] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const parsedRate = rate.trim() === '' ? null : Number(rate.replace(',', '.'))
  const rateOk =
    parsedRate === null || (Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 100)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const id = await save.mutateAsync({
        id: account?.id,
        name: name.trim(),
        kind,
        owner,
        interest_rate: parsedRate,
        color,
      })
      if (!account && opening > 0) {
        await setBalance.mutateAsync({ account: id, balance: opening, note: 'Opening balance' })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const archive = async () => {
    if (!account) return
    await save.mutateAsync({ ...account, archived: !account.archived })
    onClose()
  }

  // what deleting takes with it, said before it happens
  const summary = account && overview.accounts.find((a) => a.account.id === account.id)
  const movementCount = account
    ? overview.movements.filter((m) => m.account_id === account.id).length
    : 0
  const deleteWarning = [
    summary && summary.balance !== 0 && `its balance of ${formatMoneyCompact(summary.balance)}`,
    summary &&
      summary.allocated > 0 &&
      `${formatMoneyCompact(summary.allocated)} set aside on it for goals, which they lose`,
    movementCount > 0 && `${movementCount} ${movementCount === 1 ? 'movement' : 'movements'}`,
  ].filter(Boolean)

  const deleteAccount = async () => {
    if (!account) return
    setError(null)
    try {
      await remove.mutateAsync(account.id)
      onClose()
      onDeleted?.()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <BottomSheet title={account ? `Edit ${account.name}` : 'New account'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Revolut savings"
            className={inputClass}
            autoFocus={!account}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select value={kind} onChange={(v) => setKind(v as AccountKind)}>
              {Object.entries(ACCOUNT_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Whose">
            <Select value={owner} onChange={(v) => setOwner(v as SavingsAccount['owner'])}>
              <option value="joint">Joint</option>
              <option value="bubs">{PERSON_LABELS.bubs}</option>
              <option value="meow">{PERSON_LABELS.meow}</option>
            </Select>
          </Field>
        </div>
        {(kind === 'ike' || kind === 'ikze') && (
          <p className="-mt-2 text-xs leading-snug text-muted">
            {owner === 'joint'
              ? `An ${kind.toUpperCase()} is always one person’s: pick whose it is.`
              : `The planner keeps track of the yearly ${kind.toUpperCase()} limit and suggests a monthly payment that uses it up by December.`}
          </p>
        )}
        <Field
          label="Interest, % a year (optional)"
          help={
            rateOk
              ? 'Used for the projection; the interest itself is added when the bank pays it.'
              : 'A number between 0 and 100'
          }
        >
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="e.g. 5.5"
            className={inputClass}
          />
        </Field>
        {!account && (
          <Field
            label="Balance today"
            help="Whatever is on it already. Assign it to goals afterwards."
          >
            <MoneyInput value={opening} onChange={setOpening} label="Balance today" size="lg" />
          </Field>
        )}
        <Field label="Color">
          <ColorChoice value={color} onChange={setColor} />
        </Field>

        <SubmitRow
          label={account ? 'Save changes' : 'Add account'}
          disabled={!name.trim() || !rateOk}
          pending={save.isPending || setBalance.isPending}
          error={error}
        />
        {account && (
          <button
            type="button"
            onClick={archive}
            className="rounded-2xl py-2.5 text-sm font-semibold text-muted ring-1 ring-white/10 hover:bg-white/5"
          >
            {account.archived ? 'Show it again' : 'Hide this account'}
          </button>
        )}
        {account &&
          (confirmDelete ? (
            <div className="grid gap-2 rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-400/30">
              <p className="text-sm leading-snug text-red-200">
                {deleteWarning.length > 0
                  ? `Deleting ${account.name} also deletes ${deleteWarning.join(', ')}. This can’t be undone.`
                  : `Delete ${account.name}? This can’t be undone.`}
                {deleteWarning.length > 0 &&
                  ' To keep the history, hide it instead, or move the money to another account first.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={remove.isPending}
                  className="rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50"
                >
                  {remove.isPending ? 'Deleting…' : 'Delete for good'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-2xl py-2.5 text-sm font-semibold text-red-400 ring-1 ring-red-400/30 hover:bg-red-500/10"
            >
              Delete this account
            </button>
          ))}
      </form>
    </BottomSheet>
  )
}
