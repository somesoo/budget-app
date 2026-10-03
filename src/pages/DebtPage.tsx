import { ArrowsClockwise, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DebtSheet, debtKindLabel, debtOwnerLabel } from '../components/debts/DebtSheet'
import { DebtUpdateSheet } from '../components/debts/DebtUpdateSheet'
import { useDeleteDebtBalance } from '../hooks/useDebts'
import { useWealth } from '../hooks/useWealth'
import {
  currentMonthKey,
  formatAmount,
  formatDayLong,
  formatMoney,
  formatMoneyWhole,
  formatMonth,
} from '../lib/calculations'
import { balancesOf, monthInterest, payoff } from '../lib/debts'
import { Frame, Stat } from './SavingsDetail'
import { t } from '../i18n'

type Sheet = { kind: 'edit' } | { kind: 'update' } | null

/** One debt: what's owed, when it ends at this pace, and every balance logged. */
export function DebtPage() {
  const { id = '' } = useParams()
  const wealth = useWealth()
  const navigate = useNavigate()
  const removeBalance = useDeleteDebtBalance()
  const [sheet, setSheet] = useState<Sheet>(null)
  const debt = wealth.debts.find((d) => d.id === id)

  if (wealth.isLoading) return <Frame back="/savings" title={t('debts.title')} loading />
  if (!debt)
    return (
      <Frame back="/savings" title={t('debts.title')}>
        {t('debts.gone')}
      </Frame>
    )

  const owed = wealth.owed(debt.id)
  const own = balancesOf(wealth.balances, debt.id)
  const plan = payoff(owed, debt.interest_rate, debt.monthly_payment, currentMonthKey())
  const interestNow = monthInterest(owed, debt.interest_rate)
  const first = own[own.length - 1]
  const paidDown = first ? first.balance - owed : 0

  return (
    <Frame
      back="/savings"
      title={debt.name}
      color={debt.color}
      subtitle={`${debtKindLabel(debt.kind)} · ${debtOwnerLabel(debt.owner)}${
        debt.interest_rate != null ? ` · ${t('savingsDetail.rate', { rate: formatAmount(debt.interest_rate) })}` : ''
      }`}
      onEdit={() => setSheet({ kind: 'edit' })}
      actions={
        <button
          type="button"
          onClick={() => setSheet({ kind: 'update' })}
          className="flex h-10 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-bold text-ink hover:bg-slate-50"
        >
          <ArrowsClockwise weight="bold" aria-hidden /> {t('debts.updateShort')}
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-6">
          <section className="grid grid-cols-3 gap-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <Stat label={t('debts.owed')} value={formatMoneyWhole(owed)} />
            <Stat
              label={t('debts.payment')}
              value={debt.monthly_payment > 0 ? formatMoneyWhole(debt.monthly_payment) : '–'}
            />
            <Stat
              label={t('debts.paidOffBy')}
              value={owed <= 0 ? t('debts.cleared') : plan.month ? formatMonth(plan.month) : '–'}
            />
          </section>

          <section className="rounded-3xl bg-white/5 p-4 text-[15px] leading-relaxed text-slate-200 ring-1 ring-white/10">
            {owed <= 0 ? (
              <p>{t('debts.doneText')}</p>
            ) : plan.months === null ? (
              <p>
                {t('debts.neverText', {
                  interest: formatMoney(interestNow),
                  payment: formatMoney(debt.monthly_payment),
                })}
              </p>
            ) : (
              <p>
                {t('debts.paceText', {
                  count: plan.months,
                  month: formatMonth(plan.month!),
                  interest: formatMoneyWhole(plan.interest),
                })}
              </p>
            )}
            {interestNow > 0 && (
              <p className="mt-2 text-sm text-slate-300">
                {t('debts.interestNow', { amount: formatMoney(interestNow) })}
              </p>
            )}
            {paidDown > 0 && first && (
              <p className="mt-2 text-sm text-slate-300">
                {t('debts.paidDown', {
                  amount: formatMoneyWhole(paidDown),
                  date: formatDayLong(first.balance_date),
                })}
              </p>
            )}
          </section>
        </div>

        <section aria-labelledby="balances">
          <h2 id="balances" className="mb-3 text-base font-semibold text-white">
            {t('debts.history')}
          </h2>
          {own.length === 0 ? (
            <p className="text-sm text-muted">{t('debts.historyEmpty')}</p>
          ) : (
            <ul className="divide-y divide-white/5 rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
              {own.map((b, i) => {
                const before = own[i + 1]
                const delta = before ? b.balance - before.balance : null
                return (
                  <li key={b.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{formatDayLong(b.balance_date)}</p>
                      {b.note && <p className="truncate text-xs text-muted">{b.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-white">
                        {formatMoney(b.balance)}
                      </p>
                      {delta !== null && delta !== 0 && (
                        <p className={`text-xs tabular-nums ${delta < 0 ? 'text-positive' : 'text-red-300'}`}>
                          {delta < 0 ? '−' : '+'}
                          {formatMoney(Math.abs(delta))}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBalance.mutate(b.id)}
                      aria-label={t('debts.deleteEntry', { date: formatDayLong(b.balance_date) })}
                      className="rounded-full p-2 text-muted hover:bg-white/5 hover:text-red-300"
                    >
                      <Trash aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {sheet?.kind === 'edit' && (
        <DebtSheet debt={debt} onClose={() => setSheet(null)} onDeleted={() => navigate('/savings')} />
      )}
      {sheet?.kind === 'update' && (
        <DebtUpdateSheet debt={debt} owed={owed} onClose={() => setSheet(null)} />
      )}
    </Frame>
  )
}
