import { useState, type FormEvent } from 'react'
import {
  useDeleteAccount,
  useSaveAccount,
  useSavingsActions,
  useSavingsOverview,
} from '../../hooks/useSavings'
import { formatMoneyCompact } from '../../lib/calculations'
import { emptyAccountSteps } from '../../lib/loans'
import type { AccountKind, SavingsAccount } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, Select, SubmitRow, inputClass } from './fields'
import { ColorChoice } from './ColorChoice'
import { getPeople, personLabel } from '../../lib/people'
import { formatList, t } from '../../i18n'

const ACCOUNT_KINDS: AccountKind[] = [
  'savings',
  'deposit',
  'investment',
  'ike',
  'ikze',
  'retirement',
  'cash',
  'other',
]

export const accountKindLabel = (kind: AccountKind) => t(`account.kind.${kind}`)

export const ownerLabel = (owner: SavingsAccount['owner']) =>
  owner === 'joint' ? t('account.joint') : personLabel(owner)

/** New account, or editing one. A new one can start with the balance it has today. */
export function AccountSheet({
  account,
  onClose,
  onDeleted,
  startDeleting = false,
}: {
  account?: SavingsAccount
  onClose: () => void
  /** After the account is deleted: its page has nothing left to show. */
  onDeleted?: () => void
  /** Opened to close the account: the delete step is showing already. */
  startDeleting?: boolean
}) {
  const save = useSaveAccount()
  const remove = useDeleteAccount()
  const { setBalance, transfer } = useSavingsActions()
  const overview = useSavingsOverview()
  const [confirmDelete, setConfirmDelete] = useState(startDeleting)
  // where the money goes before the account is deleted
  const others = overview.accounts.filter(
    (a) => !a.account.archived && a.account.id !== account?.id,
  )
  const [moveTo, setMoveTo] = useState(others[0]?.account.id ?? '')
  const [moving, setMoving] = useState(false)
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
        await setBalance.mutateAsync({
          account: id,
          balance: opening,
          note: t('account.openingNote'),
        })
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
  const openLoanCount = account
    ? overview.loans.filter((l) => l.loan.account_id === account.id && l.remaining > 0).length
    : 0
  const deleteWarning = [
    summary &&
      summary.balance !== 0 &&
      t('account.loseBalance', { amount: formatMoneyCompact(summary.balance) }),
    summary &&
      summary.allocated > 0 &&
      t('account.loseAllocated', { amount: formatMoneyCompact(summary.allocated) }),
    movementCount > 0 && t('account.loseMovements', { count: movementCount }),
    openLoanCount > 0 && t('account.loseLoans', { count: openLoanCount }),
  ].filter(Boolean)
  const steps = summary ? emptyAccountSteps(summary) : []
  const target = others.find((a) => a.account.id === moveTo)

  // every goal's share moves across with its money, then the empty account goes
  const moveThenDelete = async () => {
    if (!account || !target) return
    setError(null)
    setMoving(true)
    try {
      for (const step of steps) {
        await transfer.mutateAsync({
          from: account.id,
          to: target.account.id,
          amount: step.amount,
          goal: step.goalId,
          note: t('account.closingNote', { name: account.name }),
        })
      }
      await remove.mutateAsync(account.id)
      onClose()
      onDeleted?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setMoving(false)
    }
  }

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
    <BottomSheet
      title={account ? t('project.edit', { name: account.name }) : t('account.new')}
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Field label={t('settings.categories.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={t('account.namePlaceholder')}
            className={inputClass}
            autoFocus={!account}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('entry.kind')}>
            <Select value={kind} onChange={(v) => setKind(v as AccountKind)}>
              {ACCOUNT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {accountKindLabel(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('categorySheet.whose')}>
            <Select value={owner} onChange={(v) => setOwner(v as SavingsAccount['owner'])}>
              <option value="joint">{t('account.joint')}</option>
              {getPeople().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {(kind === 'ike' || kind === 'ikze') && (
          <p className="-mt-2 text-xs leading-snug text-muted">
            {owner === 'joint'
              ? t('account.retirementOwner', { kind: kind.toUpperCase() })
              : t('account.retirementHelp', { kind: kind.toUpperCase() })}
          </p>
        )}
        <Field
          label={t('account.interest')}
          help={rateOk ? t('account.interestHelp') : t('account.interestInvalid')}
        >
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder={t('account.interestPlaceholder')}
            className={inputClass}
          />
        </Field>
        {!account && (
          <Field
            label={t('account.balanceToday')}
            help={t('account.balanceTodayHelp')}
          >
            <MoneyInput
              value={opening}
              onChange={setOpening}
              label={t('account.balanceToday')}
              size="lg"
            />
          </Field>
        )}
        <Field label={t('common.color')}>
          <ColorChoice value={color} onChange={setColor} />
        </Field>

        <SubmitRow
          label={account ? t('entry.saveChanges') : t('account.add')}
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
            {account.archived ? t('categorySheet.unhide') : t('account.hide')}
          </button>
        )}
        {account &&
          (confirmDelete ? (
            <div className="grid gap-2 rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-400/30">
              {steps.length > 0 && target && (
                <div className="grid gap-2 rounded-xl bg-white/5 p-3">
                  <p className="text-sm leading-snug text-slate-200">
                    {t('account.keepMoney', { amount: formatMoneyCompact(summary!.balance) })}
                  </p>
                  <Select value={moveTo} onChange={setMoveTo}>
                    {others.map((a) => (
                      <option key={a.account.id} value={a.account.id}>
                        {a.account.name} · {formatMoneyCompact(a.balance)}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={moveThenDelete}
                    disabled={moving || remove.isPending}
                    className="rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-ink hover:bg-slate-50 disabled:opacity-50"
                  >
                    {moving
                      ? t('account.moving')
                      : t('account.moveThenDelete', { name: target.account.name })}
                  </button>
                  <p className="text-xs leading-snug text-muted">
                    {t('account.bankSteps', {
                      amount: formatMoneyCompact(summary!.balance),
                      from: account.name,
                      to: target.account.name,
                    })}
                  </p>
                </div>
              )}
              <p className="text-sm leading-snug text-red-200">
                {deleteWarning.length > 0
                  ? t('account.deleteWarning', {
                      name: account.name,
                      what: formatList(deleteWarning as string[]),
                    })
                  : t('account.deleteConfirm', { name: account.name })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
                >
                  {t('categorySheet.keep')}
                </button>
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={remove.isPending}
                  className="rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50"
                >
                  {remove.isPending ? t('common.deleting') : t('account.deleteForGood')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-2xl py-2.5 text-sm font-semibold text-red-400 ring-1 ring-red-400/30 hover:bg-red-500/10"
            >
              {t('account.delete')}
            </button>
          ))}
      </form>
    </BottomSheet>
  )
}
