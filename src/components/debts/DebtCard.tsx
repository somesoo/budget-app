import { Link } from 'react-router-dom'
import { formatMoneyWhole, formatMonth } from '../../lib/calculations'
import type { Payoff } from '../../lib/debts'
import type { Debt } from '../../types'
import { Sparkline } from '../savings/cards'
import { debtKindLabel } from './DebtSheet'
import { t } from '../../i18n'

/** A debt in the list: what it is, what's owed, and when it'll be paid off at its own pace. */
export function DebtCard({
  debt,
  owed,
  payoff,
  history,
}: {
  debt: Debt
  owed: number
  payoff: Payoff
  history: number[]
}) {
  return (
    <li>
      <Link
        to={`/debt/${debt.id}`}
        className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10 transition hover:bg-white/[0.06]"
      >
        <span aria-hidden className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: debt.color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{debt.name}</p>
          <p className="truncate text-xs text-muted">
            {debtKindLabel(debt.kind)}
            {debt.interest_rate != null && ` · ${debt.interest_rate}%`}
            {debt.monthly_payment > 0 &&
              ` · ${t('debts.perMonth', { amount: formatMoneyWhole(debt.monthly_payment) })}`}
          </p>
        </div>
        <Sparkline values={history} color={debt.color} />
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums text-white">{formatMoneyWhole(owed)}</p>
          <p className="text-xs tabular-nums text-muted">
            {owed <= 0
              ? t('debts.cleared')
              : payoff.month
                ? t('debts.until', { month: formatMonth(payoff.month) })
                : t('debts.never')}
          </p>
        </div>
      </Link>
    </li>
  )
}
