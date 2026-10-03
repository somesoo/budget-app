import { useState, type FormEvent } from 'react'
import { useAddDebtBalance } from '../../hooks/useDebts'
import { formatMoney, roundMoney, todayKey } from '../../lib/calculations'
import { afterInstalment, monthInterest } from '../../lib/debts'
import type { Debt } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, Segments, SubmitRow, inputClass } from '../savings/fields'
import { t } from '../../i18n'

type Mode = 'instalment' | 'overpay' | 'balance'

/**
 * Brings what's owed up to date: this month's instalment paid (interest
 * added, the payment off), an overpayment, or the balance the bank shows.
 * Each adds a balance; the instalment itself is logged as an expense.
 */
export function DebtUpdateSheet({
  debt,
  owed,
  onClose,
}: {
  debt: Debt
  owed: number
  onClose: () => void
}) {
  const add = useAddDebtBalance()
  const [mode, setMode] = useState<Mode>(debt.monthly_payment > 0 ? 'instalment' : 'balance')
  const [instalment, setInstalment] = useState(debt.monthly_payment)
  const [extra, setExtra] = useState(0)
  const [balance, setBalance] = useState(owed)
  const [date, setDate] = useState(todayKey())
  const [error, setError] = useState<string | null>(null)

  const next =
    mode === 'instalment'
      ? afterInstalment(owed, debt.interest_rate, instalment)
      : mode === 'overpay'
        ? Math.max(0, roundMoney(owed - extra))
        : balance

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await add.mutateAsync({
        debt: debt.id,
        balance: next,
        date,
        note:
          mode === 'instalment'
            ? t('debts.noteInstalment')
            : mode === 'overpay'
              ? t('debts.noteOverpay', { amount: formatMoney(extra) })
              : t('debts.noteBank'),
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <BottomSheet title={t('debts.update', { name: debt.name })} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Segments
          value={mode}
          onChange={setMode}
          options={[
            { value: 'instalment', label: t('debts.modeInstalment') },
            { value: 'overpay', label: t('debts.modeOverpay') },
            { value: 'balance', label: t('debts.modeBalance') },
          ]}
        />
        {mode === 'instalment' && (
          <Field
            label={t('debts.instalmentPaid')}
            help={t('debts.instalmentHelp', {
              interest: formatMoney(monthInterest(owed, debt.interest_rate)),
            })}
          >
            <MoneyInput value={instalment} onChange={setInstalment} label={t('debts.instalmentPaid')} size="lg" />
          </Field>
        )}
        {mode === 'overpay' && (
          <Field label={t('debts.overpaid')} help={t('debts.overpaidHelp')}>
            <MoneyInput value={extra} onChange={setExtra} label={t('debts.overpaid')} size="lg" />
          </Field>
        )}
        {mode === 'balance' && (
          <Field label={t('debts.bankBalance')} help={t('debts.bankBalanceHelp')}>
            <MoneyInput value={balance} onChange={setBalance} label={t('debts.bankBalance')} size="lg" />
          </Field>
        )}
        <Field label={t('debts.date')}>
          <input
            type="date"
            value={date}
            max={todayKey()}
            onChange={(e) => setDate(e.target.value || todayKey())}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </Field>
        <p className="rounded-xl bg-white/5 px-3 py-2.5 text-sm text-slate-200">
          {t('debts.willOwe', { from: formatMoney(owed), to: formatMoney(next) })}
        </p>
        <SubmitRow label={t('entry.saveChanges')} disabled={next === owed && mode !== 'balance'} pending={add.isPending} error={error} />
      </form>
    </BottomSheet>
  )
}
