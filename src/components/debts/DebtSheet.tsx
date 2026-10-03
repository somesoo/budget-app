import { useState, type FormEvent } from 'react'
import { useDeleteDebt, useSaveDebt } from '../../hooks/useDebts'
import { getPeople, personLabel } from '../../lib/people'
import type { Debt, DebtKind } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { ColorChoice } from '../savings/ColorChoice'
import { Field, Select, SubmitRow, inputClass } from '../savings/fields'
import { t } from '../../i18n'

const DEBT_KINDS: DebtKind[] = ['mortgage', 'loan', 'card', 'installments', 'private', 'other']

export const debtKindLabel = (kind: DebtKind) => t(`debts.kind.${kind}`)

export const debtOwnerLabel = (owner: Debt['owner']) =>
  owner === 'joint' ? t('account.joint') : personLabel(owner)

/** New debt, or editing one. A new one starts with what's owed today. */
export function DebtSheet({
  debt,
  onClose,
  onDeleted,
}: {
  debt?: Debt
  onClose: () => void
  onDeleted?: () => void
}) {
  const save = useSaveDebt()
  const remove = useDeleteDebt()
  const [name, setName] = useState(debt?.name ?? '')
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? 'loan')
  const [owner, setOwner] = useState<Debt['owner']>(debt?.owner ?? 'joint')
  const [rate, setRate] = useState(debt?.interest_rate != null ? String(debt.interest_rate) : '')
  const [payment, setPayment] = useState(debt?.monthly_payment ?? 0)
  const [owed, setOwed] = useState(0)
  const [color, setColor] = useState(debt?.color ?? '#d95926')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedRate = rate.trim() === '' ? null : Number(rate.replace(',', '.'))
  const rateOk =
    parsedRate === null || (Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 100)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({
        id: debt?.id,
        name: name.trim(),
        kind,
        owner,
        interest_rate: parsedRate,
        monthly_payment: payment,
        color,
        ...(debt ? {} : { owed }),
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const archive = async () => {
    if (!debt) return
    await save.mutateAsync({ ...debt, archived: !debt.archived })
    onClose()
  }

  const deleteDebt = async () => {
    if (!debt) return
    try {
      await remove.mutateAsync(debt.id)
      onClose()
      onDeleted?.()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <BottomSheet title={debt ? t('project.edit', { name: debt.name }) : t('debts.new')} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Field label={t('settings.categories.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={t('debts.namePlaceholder')}
            className={inputClass}
            autoFocus={!debt}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('entry.kind')}>
            <Select value={kind} onChange={(v) => setKind(v as DebtKind)}>
              {DEBT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {debtKindLabel(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('categorySheet.whose')}>
            <Select value={owner} onChange={(v) => setOwner(v as Debt['owner'])}>
              <option value="joint">{t('account.joint')}</option>
              {getPeople().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!debt && (
          <Field label={t('debts.owedToday')} help={t('debts.owedTodayHelp')}>
            <MoneyInput value={owed} onChange={setOwed} label={t('debts.owedToday')} size="lg" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('debts.rate')}
            help={rateOk ? t('debts.rateHelp') : t('account.interestInvalid')}
          >
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
              placeholder="7.5"
              className={inputClass}
            />
          </Field>
          <Field label={t('debts.payment')} help={t('debts.paymentHelp')}>
            <MoneyInput value={payment} onChange={setPayment} label={t('debts.payment')} />
          </Field>
        </div>
        <Field label={t('common.color')}>
          <ColorChoice value={color} onChange={setColor} />
        </Field>

        <SubmitRow
          label={debt ? t('entry.saveChanges') : t('debts.add')}
          disabled={!name.trim() || !rateOk}
          pending={save.isPending}
          error={error}
        />
        {debt && (
          <button
            type="button"
            onClick={archive}
            className="rounded-2xl py-2.5 text-sm font-semibold text-muted ring-1 ring-white/10 hover:bg-white/5"
          >
            {debt.archived ? t('categorySheet.unhide') : t('debts.paidOff')}
          </button>
        )}
        {debt &&
          (confirmDelete ? (
            <div className="grid gap-2 rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-400/30">
              <p className="text-sm leading-snug text-red-200">
                {t('debts.deleteConfirm', { name: debt.name })}
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
                  onClick={deleteDebt}
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
              {t('debts.delete')}
            </button>
          ))}
      </form>
    </BottomSheet>
  )
}
